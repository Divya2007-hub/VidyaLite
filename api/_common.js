const config = {
  url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
};

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function missingConfig(includeServiceRole) {
  const missing = [];
  if (!config.url) missing.push('SUPABASE_URL');
  if (!config.anonKey) missing.push('SUPABASE_ANON_KEY');
  if (includeServiceRole && !config.serviceRoleKey) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  return missing;
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

async function getAuthUser(token) {
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  return response.json();
}

async function getProfile(userId, apiKey, accessToken) {
  const params = new URLSearchParams({
    select: 'id,role,display_name',
    id: `eq.${userId}`
  });
  const response = await fetch(`${config.url}/rest/v1/profiles?${params}`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${accessToken || apiKey}`
    }
  });
  if (!response.ok) {
    throw new Error(`Could not read the account profile (HTTP ${response.status}).`);
  }
  const profiles = await response.json();
  return profiles[0] || null;
}

function serviceHeaders(extra) {
  return Object.assign({
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    'Content-Type': 'application/json'
  }, extra || {});
}

module.exports = {
  config,
  sendJson,
  missingConfig,
  bearerToken,
  getAuthUser,
  getProfile,
  serviceHeaders
};
