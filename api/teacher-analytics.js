const {
  config,
  sendJson,
  missingConfig,
  bearerToken,
  getAuthUser,
  getProfile,
  serviceHeaders
} = require('./_common');

module.exports = async function (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }
  const missing = missingConfig(true);
  if (missing.length) {
    return sendJson(res, 503, {
      error: 'Teacher analytics are not configured.',
      missing
    });
  }

  const token = bearerToken(req);
  if (!token) return sendJson(res, 401, { error: 'Teacher sign-in is required.' });

  try {
    const teacher = await getAuthUser(token);
    if (!teacher || !teacher.id) {
      return sendJson(res, 401, { error: 'Your sign-in has expired. Sign in again.' });
    }
    const profile = await getProfile(
      teacher.id,
      config.serviceRoleKey,
      config.serviceRoleKey
    );
    if (!profile || profile.role !== 'teacher') {
      return sendJson(res, 403, { error: 'Teacher access is required.' });
    }

    const studentsParams = new URLSearchParams({
      select: 'id,email,display_name',
      teacher_id: `eq.${teacher.id}`,
      role: 'eq.student',
      order: 'display_name.asc',
      limit: '1000'
    });
    const studentsResponse = await fetch(
      `${config.url}/rest/v1/profiles?${studentsParams}`,
      { headers: serviceHeaders() }
    );
    if (!studentsResponse.ok) {
      throw new Error(`Could not load students (HTTP ${studentsResponse.status}).`);
    }
    const students = await studentsResponse.json();
    if (!students.length) return sendJson(res, 200, { students: [], answers: [], truncated: false });

    const studentIds = students.map(student => student.id);
    const answers = [];
    const pageSize = 1000;
    const maxRows = 20000;
    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const params = new URLSearchParams({
        select: 'id,student_id,subject,topic,difficulty,correct,answered_at',
        student_id: `in.(${studentIds.join(',')})`,
        order: 'answered_at.desc',
        limit: String(pageSize),
        offset: String(offset)
      });
      const response = await fetch(
        `${config.url}/rest/v1/answer_events?${params}`,
        { headers: serviceHeaders() }
      );
      if (!response.ok) {
        throw new Error(`Could not load student answers (HTTP ${response.status}).`);
      }
      const page = await response.json();
      answers.push(...page);
      if (page.length < pageSize) {
        return sendJson(res, 200, { students, answers, truncated: false });
      }
    }
    return sendJson(res, 200, { students, answers, truncated: true });
  } catch (error) {
    console.error('Teacher analytics request failed:', error);
    return sendJson(res, 502, { error: 'Could not load teacher analytics. Try again later.' });
  }
};
