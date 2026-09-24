// ─── Markdown mínimo y seguro (sin dependencias) ───────────────
// Escapa todo el HTML primero; solo genera etiquetas conocidas y
// solo permite enlaces/imágenes con esquemas seguros.
(function() {
const esc = (s) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const safeUrl = (url) => {
  const u = url.trim();
  const scheme = u.match(/^([a-z][a-z0-9+.-]*):/i);
  // Solo http(s), mailto, anclas y rutas relativas (nunca "javascript:", "data:"…)
  if (scheme) return /^(https?|mailto)$/i.test(scheme[1]) ? u : null;
  return u.startsWith('//') ? null : u;
};

function inline(text) {
  const codes = [];
  let h = text.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  h = h
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => {
      const u = safeUrl(url);
      return u ? `<img src="${u}" alt="${alt}" loading="lazy">` : m;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const u = safeUrl(url);
      if (!u) return m;
      const ext = /^https?:\/\//i.test(u);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>');
  return h.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
}

function renderMarkdown(src) {
  if (!src) return '';
  const text = esc(String(src).replace(/\r\n?/g, '\n'));
  const blocks = [];
  // Bloques de código cercados ```lang … ```
  const withFences = text.replace(/^```([\w+-]*)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm, (_, lang, code) => {
    blocks.push(`<pre${lang ? ` data-lang="${lang}"` : ''}><code>${code.replace(/\n$/, '')}</code></pre>`);
    return `\n\n\u0001${blocks.length - 1}\u0001\n\n`;
  });

  return withFences.split(/\n{2,}/).map(chunk => {
    const b = chunk.trim();
    if (!b) return '';
    const fence = b.match(/^\u0001(\d+)\u0001$/);
    if (fence) return blocks[+fence[1]];

    const lines = b.split('\n');
    const hd = lines[0].match(/^(#{1,4})\s+(.+)$/);
    const level = (hashes) => Math.min(Math.max(hashes.length, 2), 4); // "#" → h2: el h1 es el título del post
    if (hd && lines.length === 1) { const n = level(hd[1]); return `<h${n}>${inline(hd[2])}</h${n}>`; }

    if (lines.every(l => /^\s*[-*+]\s+/.test(l))) {
      return '<ul>' + lines.map(l => `<li>${inline(l.replace(/^\s*[-*+]\s+/, ''))}</li>`).join('') + '</ul>';
    }
    if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) {
      return '<ol>' + lines.map(l => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('') + '</ol>';
    }
    if (lines.every(l => /^&gt;\s?/.test(l))) {
      return '<blockquote>' + inline(lines.map(l => l.replace(/^&gt;\s?/, '')).join('<br>')) + '</blockquote>';
    }
    if (/^(-{3,}|\*{3,})$/.test(b)) return '<hr>';
    // Encabezado seguido de texto sin línea en blanco
    if (hd) {
      const n = level(hd[1]);
      return `<h${n}>${inline(hd[2])}</h${n}><p>${inline(lines.slice(1).join('<br>'))}</p>`;
    }
    return `<p>${inline(lines.join('<br>'))}</p>`;
  }).join('\n');
}

const readingTime = (src) => Math.max(1, Math.round(String(src || '').split(/\s+/).length / 200));

window.renderMarkdown = renderMarkdown;
window.readingTime = readingTime;
})();
