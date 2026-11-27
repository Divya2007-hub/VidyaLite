const { config, sendJson, missingConfig } = require('./_common');

module.exports = function (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  const missing = missingConfig(false);
  if (missing.length) {
    return sendJson(res, 200, {
      configured: false,
      error: 'Supabase is not configured for this deployment.',
      missing
    });
  }

  try {
    const url = new URL(config.url);
    if (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      return sendJson(res, 500, { error: 'SUPABASE_URL must use HTTPS.' });
    }
  } catch (error) {
    return sendJson(res, 500, { error: 'SUPABASE_URL is invalid.' });
  }

  return sendJson(res, 200, {
    supabaseUrl: config.url,
    anonKey: config.anonKey
  });
};
