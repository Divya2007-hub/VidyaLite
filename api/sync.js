const {
  sendJson,
  missingConfig,
  bearerToken,
  getAuthUser,
  getProfile,
  config
} = require('./_common');

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  const missing = missingConfig(false);
  if (missing.length) {
    return sendJson(res, 503, {
      error: 'Progress sync is not configured.',
      missing
    });
  }

  const token = bearerToken(req);
  if (!token) return sendJson(res, 401, { error: 'Sign in to sync progress.' });
  const events = req.body && req.body.events;
  if (!Array.isArray(events) || events.length > 500) {
    return sendJson(res, 400, { error: 'Sync batch must contain at most 500 answer records.' });
  }

  try {
    const user = await getAuthUser(token);
    if (!user || !user.id) {
      return sendJson(res, 401, { error: 'Your sign-in has expired. Sign in again.' });
    }
    const profile = await getProfile(user.id, config.anonKey, token);
    if (!profile || profile.role !== 'student') {
      return sendJson(res, 403, { error: 'Only student accounts can sync learning progress.' });
    }

    const rows = [];
    for (const event of events) {
      const difficulty = event && typeof event.difficulty === 'string'
        ? event.difficulty.toLowerCase()
        : '';
      if (!event || typeof event.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(event.id) ||
          typeof event.questionId !== 'string' || event.questionId.length > 200 ||
          typeof event.subject !== 'string' || event.subject.length > 80 ||
          typeof event.topic !== 'string' || event.topic.length > 120 ||
          !['easy', 'medium', 'hard'].includes(difficulty) ||
          typeof event.correct !== 'boolean' || Number.isNaN(Date.parse(event.answeredAt))) {
        return sendJson(res, 400, { error: 'The sync batch contains an invalid answer record.' });
      }
      rows.push({
        id: event.id,
        student_id: user.id,
        question_id: event.questionId,
        subject: event.subject,
        topic: event.topic,
        difficulty,
        correct: event.correct,
        answered_at: new Date(event.answeredAt).toISOString()
      });
    }

    if (rows.length) {
      const response = await fetch(`${config.url}/rest/v1/answer_events?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=minimal'
        },
        body: JSON.stringify(rows)
      });
      if (!response.ok) {
        console.error('Supabase progress sync rejected the batch:', response.status);
        return sendJson(res, 502, { error: 'Supabase could not save the progress batch.' });
      }
    }
    return sendJson(res, 200, { syncedIds: rows.map(row => row.id) });
  } catch (error) {
    console.error('Progress sync failed:', error);
    return sendJson(res, 502, { error: 'Could not sync progress. It remains saved on this device.' });
  }
};
