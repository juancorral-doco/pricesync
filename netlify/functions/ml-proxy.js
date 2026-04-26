// netlify/functions/ml-proxy.js
// Proxy seguro para la API de MercadoLibre
// Las credenciales viven en variables de entorno de Netlify, nunca en el frontend

const ML_CLIENT_ID     = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const ML_USER_ID       = process.env.ML_USER_ID || '122478';

// Token cache en memoria (se resetea con cada deploy, pero dura mientras la función está caliente)
let cachedToken   = process.env.ML_INITIAL_TOKEN || '';
let tokenExpiry   = 0;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ── Obtener token válido ───────────────────────────────────────────────────────
async function getValidToken() {
  // Si el token en cache tiene más de 5h de vida, lo usamos
  if (cachedToken && Date.now() < tokenExpiry - 5 * 60 * 1000) {
    return cachedToken;
  }

  // Intentar renovar con authorization_code guardado
  // Como ML no da refresh_token sin offline_access, usamos el token inicial
  // y lo cacheamos. Cuando vence, la función devuelve error y el frontend avisa.
  if (!cachedToken) {
    throw new Error('No hay token disponible. Actualizá ML_INITIAL_TOKEN en las variables de entorno de Netlify.');
  }

  // Verificar que el token actual sigue siendo válido
  const check = await fetch('https://api.mercadolibre.com/users/me?access_token=' + cachedToken);
  if (check.ok) {
    // Extender el cache
    tokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
    return cachedToken;
  }

  throw new Error('Token de MercadoLibre vencido. Actualizá ML_INITIAL_TOKEN en las variables de entorno de Netlify.');
}

// ── Handler principal ─────────────────────────────────────────────────────────
exports.handler = async function(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const path   = (event.queryStringParameters && event.queryStringParameters.path) || '';
  const action = (event.queryStringParameters && event.queryStringParameters.action) || 'proxy';

  try {
    // ── Acción: actualizar token desde el frontend ─────────────────────────
    if (action === 'update-token') {
      if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
      }
      const body = JSON.parse(event.body || '{}');
      const newToken = body.token || '';
      if (!newToken.startsWith('APP_USR-') || newToken.startsWith('APP_USR-TG-')) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Token inválido' }) };
      }
      cachedToken = newToken;
      tokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, message: 'Token actualizado' }) };
    }

    // ── Acción: verificar estado del token ────────────────────────────────
    if (action === 'status') {
      let status = 'unknown';
      try {
        await getValidToken();
        const minsLeft = Math.round((tokenExpiry - Date.now()) / 60000);
        status = minsLeft > 0 ? 'valid:' + minsLeft : 'expired';
      } catch(e) {
        status = 'expired';
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ status }) };
    }

    // ── Acción: proxy a la API de ML ───────────────────────────────────────
    const token = await getValidToken();

    // Rutas permitidas (whitelist de seguridad)
    const allowed = [
      /^\/users\/\d+\/items\/search/,
      /^\/items$/,
      /^\/items\/MLA\d+\/prices/,
      /^\/users\/me$/,
    ];
    const isAllowed = allowed.some(function(re) { return re.test(path); });
    if (!isAllowed) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Ruta no permitida: ' + path }) };
    }

    // Construir URL de ML
    const qs    = Object.assign({}, event.queryStringParameters || {});
    delete qs.path; delete qs.action;
    qs.access_token = token;
    const qStr  = Object.keys(qs).map(function(k) { return k + '=' + encodeURIComponent(qs[k]); }).join('&');
    const mlUrl = 'https://api.mercadolibre.com' + path + (qStr ? '?' + qStr : '');

    const resp = await fetch(mlUrl);
    const data = await resp.text();

    return {
      statusCode: resp.status,
      headers: Object.assign({ 'Content-Type': 'application/json' }, CORS),
      body: data,
    };

  } catch(err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
