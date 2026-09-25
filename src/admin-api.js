// ─── Cliente de la API del panel ───────────────────────────────
// Guarda el token CSRF de la sesión y lo añade a toda petición que modifica datos.
let csrfToken = '';

export const setCsrfToken = (t) => { csrfToken = t || ''; };

export async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (csrfToken && opts.method && opts.method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
  const res = await fetch('api' + path, { ...opts, headers });
  const data = await res.json();
  if (data && typeof data === 'object') data.httpStatus = res.status;
  return data;
}

// Subida de un archivo a Multimedia (multipart: sin Content-Type JSON)
export async function uploadMedia(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('api/media', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: fd });
  return res.json();
}
