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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const missing = missingConfig(true);
  if (missing.length) {
    return sendJson(res, 503, {
      error: 'Student account creation is not configured.',
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
    const teacherProfile = await getProfile(
      teacher.id,
      config.serviceRoleKey,
      config.serviceRoleKey
    );
    if (!teacherProfile || teacherProfile.role !== 'teacher') {
      return sendJson(res, 403, { error: 'Only teacher accounts can create students.' });
    }

    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJson(res, 400, { error: 'Enter a valid student email address.' });
    }
    if (displayName.length < 1 || displayName.length > 100) {
      return sendJson(res, 400, { error: 'Student name must be between 1 and 100 characters.' });
    }
    if (password.length < 8 || password.length > 72) {
      return sendJson(res, 400, { error: 'Initial password must be between 8 and 72 characters.' });
    }

    const createResponse = await fetch(`${config.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName }
      })
    });
    const createdUser = await createResponse.json();
    if (!createResponse.ok || !createdUser.id) {
      console.error('Supabase rejected student account creation:', createResponse.status);
      return sendJson(res, createResponse.status || 502, {
        error: 'Could not create the student account. Check the email and try again.'
      });
    }

    const profileResponse = await fetch(`${config.url}/rest/v1/profiles`, {
      method: 'POST',
      headers: serviceHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        id: createdUser.id,
        role: 'student',
        teacher_id: teacher.id,
        display_name: displayName,
        email
      })
    });
    if (!profileResponse.ok) {
      console.error('Student profile creation failed:', profileResponse.status);
      const cleanupResponse = await fetch(
        `${config.url}/auth/v1/admin/users/${encodeURIComponent(createdUser.id)}`,
        { method: 'DELETE', headers: serviceHeaders() }
      );
      if (!cleanupResponse.ok) {
        return sendJson(res, 502, {
          error: 'Student account cleanup failed. Contact an administrator before sharing its credentials.'
        });
      }
      return sendJson(res, 502, {
        error: 'Could not create the student account. Check the email and try again.'
      });
    }

    return sendJson(res, 201, {
      student: {
        id: createdUser.id,
        email,
        displayName
      }
    });
  } catch (error) {
    console.error('Student account creation failed:', error);
    return sendJson(res, 502, { error: 'Could not create the student account. Try again later.' });
  }
};
