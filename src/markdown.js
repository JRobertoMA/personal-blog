// ─── Markdown de los posts (markdown-it) ───────────────────────
// Compartido por el escritorio, el móvil y el panel. API global:
//   renderMarkdown(src)        → HTML seguro
//   markdownOutline(src)       → { toc: [{level, id, text}], externalImages: [url] }
//   readingTime(src)           → minutos
//   handleMarkdownClick(e, o)  → delegación: copiar código, anclas internas, clic en imagen
//
// Seguridad: html:false escapa cualquier HTML del autor, y validateLink solo deja
// http(s), mailto y rutas relativas. Las etiquetas extra (casillas, avisos, cabecera
// de código) salen de cadenas fijas o escapadas aquí, nunca del texto del post.
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
// El resaltado de sintaxis va en un bundle aparte (src/highlight.js → assets/hljs.js)
// que highlightCode() descarga solo si el post tiene bloques de código.
// Nombres y alias que ese bundle reconoce:
const HL_LANGS = new Set(('bash sh zsh shell console javascript js jsx mjs cjs typescript ts tsx mts cts ' +
  'php python py gyp ipython rust rs c h cpp cc c++ h++ hpp hh hxx cxx go golang sql json jsonc yaml yml ' +
  'ini toml diff patch css xml html xhtml rss atom xjb xsd xsl plist svg dockerfile docker makefile mk mak make ' +
  'nginx nginxconf apache apacheconf').split(' '));

const escapeHtml = MarkdownIt().utils.escapeHtml;

// ── Enlaces permitidos ─────────────────────────────────────────
// http(s), mailto, anclas y rutas relativas. Nunca javascript:, data:, file:…
// ni "//host" (relativa al protocolo, saldría del sitio sin que se note).
function validateLink(url) {
  const u = String(url).trim();
  if (u.startsWith('//')) return false;
  const scheme = u.match(/^([a-z][a-z0-9+.-]*):/i);
  return !scheme || /^(https?|mailto)$/i.test(scheme[1]);
}

const isExternal = (url) => /^https?:\/\//i.test(url);

// ── Slugs para los encabezados (índice y anclas) ───────────────
function slugify(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seccion';
}

const inlineText = (token) => (token.children || [])
  .filter(t => t.type === 'text' || t.type === 'code_inline')
  .map(t => t.content).join('');

// ── Reglas propias ────────────────────────────────────────────

// "#" y "##" → h2 (el h1 es el título del post); el resto baja igual.
// Cada encabezado recibe un id único dentro del post.
function headingsRule(state) {
  const used = new Map();
  const toc = [];
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'heading_open') continue;
    const level = Math.max(2, +t.tag.slice(1));
    t.tag = tokens[i + 2].tag = `h${level}`;
    const text = inlineText(tokens[i + 1]);
    let id = slugify(text);
    const n = (used.get(id) || 0) + 1;
    used.set(id, n);
    if (n > 1) id += `-${n}`;
    t.attrSet('id', id);
    toc.push({ level, id, text });
  }
  state.env.toc = toc;
}

// - [ ] tarea / - [x] hecha → casilla deshabilitada
function taskListRule(state) {
  const tokens = state.tokens;
  for (let i = 2; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue;
    const m = t.content.match(/^\[([ xX])\][ \t]/);
    const first = t.children[0];
    if (!m || !first || first.type !== 'text' || !first.content.startsWith(m[0])) continue;
    first.content = first.content.slice(m[0].length);
    t.content = t.content.slice(m[0].length);
    const box = new state.Token('html_inline', '', 0);
    box.content = `<input type="checkbox" class="md-task-box" disabled${m[1] === ' ' ? '' : ' checked'}> `;
    t.children.unshift(box);
    tokens[i - 2].attrJoin('class', 'md-task');
    // Marca la lista contenedora
    for (let j = i - 3, depth = 0; j >= 0; j--) {
      if (tokens[j].type === 'bullet_list_close' || tokens[j].type === 'ordered_list_close') depth++;
      if (tokens[j].type === 'bullet_list_open' || tokens[j].type === 'ordered_list_open') {
        if (depth === 0) { if (!tokens[j].attrGet('class')) tokens[j].attrSet('class', 'md-tasks'); break; }
        depth--;
      }
    }
  }
}

// > [!NOTE] … → aviso con título (sintaxis de GitHub)
const ALERTS = { note: 'Nota', tip: 'Consejo', important: 'Importante', warning: 'Atención', caution: 'Cuidado' };

function alertsRule(state) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'blockquote_open') continue;
    const inline = tokens[i + 2];
    if (tokens[i + 1]?.type !== 'paragraph_open' || inline?.type !== 'inline') continue;
    const m = inline.content.match(/^\[!(note|tip|important|warning|caution)\](?:[ \t]*\n|[ \t]+|$)/i);
    if (!m) continue;
    const kind = m[1].toLowerCase();

    // Quita el marcador (y el salto que le sigue) del texto
    inline.content = inline.content.slice(m[0].length);
    const kids = inline.children;
    kids[0].content = kids[0].content.replace(/^\[![a-z]+\][ \t]*/i, '');
    if (!kids[0].content) kids.shift();
    if (kids[0] && (kids[0].type === 'softbreak' || kids[0].type === 'hardbreak')) kids.shift();

    // blockquote → div.md-alert (busca su cierre respetando anidados)
    let close = i + 1;
    for (let depth = 0; close < tokens.length; close++) {
      if (tokens[close].type === 'blockquote_open') depth++;
      if (tokens[close].type === 'blockquote_close') { if (depth === 0) break; depth--; }
    }
    tokens[i].tag = tokens[close].tag = 'div';
    tokens[i].attrSet('class', `md-alert md-alert-${kind}`);
    tokens[i].attrSet('role', 'note');

    const title = new state.Token('html_block', '', 0);
    title.content = `<p class="md-alert-title">${ALERTS[kind]}</p>\n`;
    if (!inline.content.trim()) tokens.splice(i + 1, 3, title); // el marcador iba solo
    else tokens.splice(i + 1, 0, title);
  }
}

// Párrafo que solo contiene una imagen con título → <figure> con pie
function figuresRule(state) {
  const tokens = state.tokens;
  for (let i = 1; i < tokens.length - 1; i++) {
    const t = tokens[i];
    if (t.type !== 'inline' || tokens[i - 1].type !== 'paragraph_open') continue;
    const kids = t.children.filter(k => !(k.type === 'text' && !k.content.trim()));
    if (kids.length !== 1 || kids[0].type !== 'image' || !kids[0].attrGet('title')) continue;
    kids[0].meta = { ...(kids[0].meta || {}), figure: true };
    tokens[i - 1].tag = tokens[i + 1].tag = 'figure';
    tokens[i - 1].attrSet('class', 'md-figure');
  }
}

function collectImages(state) {
  const images = [];
  for (const t of state.tokens) {
    if (t.type !== 'inline') continue;
    for (const k of t.children || []) if (k.type === 'image') images.push(k.attrGet('src'));
  }
  state.env.images = images;
}

// ── Instancia ─────────────────────────────────────────────────
const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false });
md.validateLink = validateLink;
md.linkify.set({ fuzzyLink: false });
md.use(footnote);
md.core.ruler.push('jr_headings', headingsRule);
md.core.ruler.push('jr_tasks', taskListRule);
md.core.ruler.push('jr_alerts', alertsRule);
md.core.ruler.push('jr_figures', figuresRule);
md.core.ruler.push('jr_images', collectImages);

const rules = md.renderer.rules;

rules.link_open = (tokens, i, opts, env, self) => {
  if (isExternal(tokens[i].attrGet('href') || '')) {
    tokens[i].attrSet('target', '_blank');
    tokens[i].attrSet('rel', 'noopener noreferrer');
  }
  return self.renderToken(tokens, i, opts);
};

rules.image = (tokens, i, opts, env, self) => {
  const t = tokens[i];
  const src = escapeHtml(t.attrGet('src') || '');
  const alt = escapeHtml(self.renderInlineAsText(t.children, opts, env));
  const title = t.attrGet('title') || '';
  const ext = isExternal(t.attrGet('src') || '') ? ' data-external="1"' : '';
  const img = `<img src="${src}" alt="${alt}" loading="lazy" decoding="async"${ext}`;
  if (t.meta?.figure) return `${img}><figcaption>${escapeHtml(title)}</figcaption>`;
  return `${img}${title ? ` title="${escapeHtml(title)}"` : ''}>`;
};

rules.table_open = () => '<div class="md-table"><table>\n';
rules.table_close = () => '</table></div>\n';

// Bloques de código: cabecera con el lenguaje + botón copiar. El código sale
// escapado; data-hl marca los que highlightCode() colorea después.
const codeBlock = (content, lang) => {
  const hl = lang && HL_LANGS.has(lang);
  const label = lang ? escapeHtml(lang) : 'código';
  return `<div class="md-code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}>` +
    `<div class="md-code-bar"><span>${label}</span><button type="button" class="md-copy" aria-label="Copiar código">copiar</button></div>` +
    `<pre><code class="hljs"${hl ? ` data-hl="${escapeHtml(lang)}"` : ''}>${escapeHtml(content).replace(/\n$/, '')}</code></pre></div>\n`;
};
rules.fence = (tokens, i) => {
  const lang = (tokens[i].info || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^\w+#.-]/g, '');
  return codeBlock(tokens[i].content, lang);
};
rules.code_block = (tokens, i) => codeBlock(tokens[i].content, '');

// ── API pública ───────────────────────────────────────────────
// env (opcional) recibe env.toc y env.images tras renderizar
function renderMarkdown(src, env = {}) {
  if (!src) { env.toc = []; env.images = []; return ''; }
  return md.render(String(src), env);
}

function markdownOutline(src) {
  const env = {};
  md.parse(String(src || ''), env);
  return { toc: env.toc || [], externalImages: (env.images || []).filter(isExternal) };
}

const readingTime = (src) => Math.max(1, Math.round(String(src || '').split(/\s+/).filter(Boolean).length / 200));

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}

// Poner como onClick del contenedor del HTML renderizado.
// opts.onImage(src, alt, img) — abre la imagen (ventana o visor); si no se da, no hace nada.
function handleMarkdownClick(e, opts = {}) {
  const root = e.currentTarget;
  const copy = e.target.closest('.md-copy');
  if (copy && root.contains(copy)) {
    e.preventDefault();
    const code = copy.closest('.md-code')?.querySelector('code');
    copyText(code ? code.textContent : '').then(ok => {
      copy.textContent = ok ? 'copiado ✓' : 'error';
      clearTimeout(copy._t);
      copy._t = setTimeout(() => { copy.textContent = 'copiar'; }, 1600);
    });
    return;
  }
  // Anclas internas (#seccion, notas al pie): el hash de la URL lo usa el router
  // del móvil, así que se desplaza dentro del post sin tocar location.hash.
  const a = e.target.closest('a[href^="#"]');
  if (a && root.contains(a)) {
    e.preventDefault();
    scrollToAnchor(root, decodeURIComponent(a.getAttribute('href').slice(1)));
    return;
  }
  const img = e.target.closest('img');
  if (img && root.contains(img) && opts.onImage && !img.closest('a')) {
    opts.onImage(img.getAttribute('src'), img.getAttribute('alt') || '', img);
  }
}

function scrollToAnchor(root, id) {
  const target = id && root.querySelector(`[id="${CSS.escape(id)}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  target.classList.add('md-flash');
  setTimeout(() => target.classList.remove('md-flash'), 1200);
}

// Colorea los bloques con data-hl dentro de root; descarga assets/hljs.js la primera vez.
let hlLoad = null;
function loadHighlighter() {
  if (window.jrHighlight) return Promise.resolve(window.jrHighlight);
  if (!hlLoad) {
    hlLoad = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'assets/hljs.js';
      s.async = true;
      s.onload = () => (window.jrHighlight ? resolve(window.jrHighlight) : reject(new Error('hljs')));
      s.onerror = () => { hlLoad = null; s.remove(); reject(new Error('hljs')); };
      document.head.appendChild(s);
    });
  }
  return hlLoad;
}

function highlightCode(root) {
  if (!root) return;
  const pending = [...root.querySelectorAll('code[data-hl]:not([data-hl-done])')];
  if (!pending.length) return;
  loadHighlighter().then(highlight => {
    for (const el of pending) {
      if (!el.isConnected || el.dataset.hlDone) continue;
      const html = highlight(el.textContent, el.dataset.hl);
      if (html !== null) el.innerHTML = html; // HTML escapado por highlight.js
      el.dataset.hlDone = '1';
    }
  }).catch(() => {}); // sin resaltado: el código se sigue viendo, solo sin colores
}

window.renderMarkdown = renderMarkdown;
window.highlightCode = highlightCode;
window.markdownOutline = markdownOutline;
window.readingTime = readingTime;
window.handleMarkdownClick = handleMarkdownClick;
window.scrollToMarkdownAnchor = scrollToAnchor;
