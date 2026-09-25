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

// ── Tablas estilo GitHub ──────────────────────────────────────
// | a | b |          ← cabecera
// |---|:-:|          ← separador (":" indica alineación)
// | 1 | 2 |          ← filas
const TABLE_SEP = /^\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?$/;
const isTableRow = (l) => l.includes('|');

function splitRow(line) {
  let l = line.trim();
  if (l.startsWith('|')) l = l.slice(1);
  if (l.endsWith('|') && !l.endsWith('\\|')) l = l.slice(0, -1);
  // "\|" es una barra literal dentro de la celda
  return l.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
}

function renderTable(lines) {
  const head = splitRow(lines[0]);
  const align = splitRow(lines[1]).map(c =>
    c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : '');
  const cell = (tag, c, i) => `<${tag}${align[i] ? ` style="text-align:${align[i]}"` : ''}>${inline(c)}</${tag}>`;
  const rows = lines.slice(2).map(l => {
    const cells = splitRow(l);
    return '<tr>' + head.map((_, i) => cell('td', cells[i] || '', i)).join('') + '</tr>';
  });
  return '<div class="md-table"><table><thead><tr>' + head.map((c, i) => cell('th', c, i)).join('') +
    '</tr></thead>' + (rows.length ? '<tbody>' + rows.join('') + '</tbody>' : '') + '</table></div>';
}

// Separa un bloque en [texto, tabla, texto…] cuando contiene una tabla
function extractTables(lines) {
  const parts = [];
  let buf = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = isTableRow(lines[i]) ? splitRow(lines[i]).length : 0;
    if (cols && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1].trim()) && splitRow(lines[i + 1]).length === cols) {
      if (buf.length) { parts.push({ lines: buf }); buf = []; }
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j]) && lines[j].trim()) j++;
      parts.push({ table: lines.slice(i, j) });
      i = j - 1;
    } else {
      buf.push(lines[i]);
    }
  }
  if (buf.length) parts.push({ lines: buf });
  return parts;
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

    const parts = extractTables(b.split('\n'));
    if (parts.some(p => p.table)) {
      return parts.map(p => (p.table ? renderTable(p.table) : renderBlock(p.lines.join('\n').trim()))).join('\n');
    }
    return renderBlock(b);
  }).join('\n');
}

function renderBlock(b) {
    if (!b) return '';
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
}

const readingTime = (src) => Math.max(1, Math.round(String(src || '').split(/\s+/).length / 200));

window.renderMarkdown = renderMarkdown;
window.readingTime = readingTime;
})();
