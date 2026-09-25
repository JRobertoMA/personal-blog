// Pruebas del intérprete de Markdown: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {};
await import('../src/markdown.js');
const md = (s) => window.renderMarkdown(s);
const has = (src, ...parts) => { const h = md(src); for (const p of parts) assert.ok(h.includes(p), `falta ${p}\n→ ${h}`); return h; };
const lacks = (src, ...parts) => { const h = md(src); for (const p of parts) assert.ok(!h.includes(p), `sobra ${p}\n→ ${h}`); return h; };

test('listas anidadas', () => {
  const h = md('- a\n  - b\n- c');
  assert.match(h, /<li>a\s*<ul>\s*<li>b<\/li>/);
});
test('lista justo después de un párrafo', () => has('Texto:\n- a\n- b', '<p>Texto:</p>', '<ul>', '<li>a</li>'));
test('lista numerada que no empieza en 1', () => has('3. tres\n4. cuatro', '<ol start="3">'));
test('tareas', () => {
  const h = has('- [ ] pendiente\n- [x] hecho', 'class="md-tasks"', 'class="md-task"', '<input type="checkbox" class="md-task-box" disabled> pendiente', 'disabled checked> hecho');
  assert.ok(!h.includes('[ ]'));
});
test('código dentro de una lista', () => has('1. paso\n\n   ```bash\n   make\n   ```\n2. otro', '<ol>', 'data-lang="bash"', '<li>\n<p>otro</p>'));
test('cita con varios párrafos y lista', () => {
  has('> uno\n>\n> dos', '<blockquote>\n<p>uno</p>\n<p>dos</p>');
  has('> - a\n> - b', '<blockquote>\n<ul>');
});
test('encabezados: # y ## → h2, h5, setext, ids únicos', () => {
  has('# Uno', '<h2 id="uno">');
  has('## Dos', '<h2 id="dos">');
  has('##### cinco', '<h5 id="cinco">');
  has('Titulo\n======', '<h2 id="titulo">');
  has('## Instalación rápida\n\n## Instalación rápida', 'id="instalacion-rapida"', 'id="instalacion-rapida-2"');
});
test('enlaces: paréntesis, título, externos, autolinks', () => {
  has('[wiki](https://es.wikipedia.org/wiki/Linux_(kernel))', 'href="https://es.wikipedia.org/wiki/Linux_(kernel)"');
  has('[a](https://a.com "t")', 'title="t"', 'target="_blank"', 'rel="noopener noreferrer"');
  has('ver https://jrobertoma.com y <https://x.com>', 'href="https://jrobertoma.com"', 'href="https://x.com"');
  lacks('[local](/post/1)', 'target=');
  lacks('archivo.md y ejemplo.com', '<a');
});
test('énfasis con guion bajo y escapes', () => {
  has('_cursiva_ y __negrita__ y snake_case_var', '<em>cursiva</em>', '<strong>negrita</strong>', 'snake_case_var');
  has('\\*no cursiva\\*', '*no cursiva*');
  has('~~tachado~~', '<s>tachado</s>');
});
test('hr, notas al pie y código en línea con backtick', () => {
  has('a\n\n- - -\n\nb', '<hr>');
  has('texto[^1]\n\n[^1]: nota', 'class="footnote-ref"', 'class="footnotes"');
  has('`` a`b ``', '<code>a`b</code>');
});
test('saltos de línea simples siguen siendo <br> (compatibilidad)', () => has('linea1\nlinea2', 'linea1<br>\nlinea2'));
test('tablas envueltas y alineadas', () => has('| a | b |\n|:-:|--:|\n| 1 | 2 |', '<div class="md-table"><table>', 'style="text-align:center"', 'style="text-align:right"'));
test('bloques de código: cabecera, marca de resaltado y lenguaje desconocido', () => {
  has('```php\n<?php echo 1;\n```', '<code class="hljs" data-hl="php">&lt;?php echo 1;</code>', 'class="md-copy"');
  has('```PHP\nx\n```', 'data-hl="php"');
  const h = has('```inventado\n<b>x</b>\n```', 'data-lang="inventado"', '&lt;b&gt;x&lt;/b&gt;');
  assert.ok(!h.includes('data-hl'));
  has('```\nsin lenguaje\n```', '<span>código</span>');
});
test('imágenes: lazy, figura con pie, externas marcadas', () => {
  has('![alt](uploads/media/a.png)', '<img src="uploads/media/a.png" alt="alt" loading="lazy"');
  has('![alt](uploads/media/a.png "Pie de foto")', '<figure class="md-figure">', '<figcaption>Pie de foto</figcaption>');
  has('![x](https://i.imgur.com/a.png)', 'data-external="1"');
  assert.deepEqual(window.markdownOutline('![x](https://i.imgur.com/a.png) ![y](uploads/b.png)').externalImages, ['https://i.imgur.com/a.png']);
});
test('avisos estilo GitHub', () => {
  has('> [!NOTE]\n> Texto', '<div class="md-alert md-alert-note" role="note">', '<p class="md-alert-title">Nota</p>', '<p>Texto</p>');
  lacks('> [!NOTE]\n> Texto', '[!NOTE]', '<blockquote');
  has('> [!WARNING] Cuidado con esto', 'md-alert-warning', '<p>Cuidado con esto</p>');
  has('> cita normal', '<blockquote>');
});
test('índice', () => {
  const { toc } = window.markdownOutline('# A\n\n### B\n\ntexto\n\n## C');
  assert.deepEqual(toc, [{ level: 2, id: 'a', text: 'A' }, { level: 3, id: 'b', text: 'B' }, { level: 2, id: 'c', text: 'C' }]);
});

test('resaltado (assets/hljs.js): todos los alias de HL_LANGS existen y el HTML sale escapado', async () => {
  const { default: highlight } = await import('../src/highlight.js');
  const src = (await import('node:fs')).readFileSync(new URL('../src/markdown.js', import.meta.url), 'utf8');
  const list = src.match(/HL_LANGS = new Set\(\(([\s\S]*?)\)\.split/)[1].replace(/'\s*\+\s*'/g, '').replace(/'/g, '');
  for (const lang of list.trim().split(/\s+/)) assert.notEqual(highlight('x', lang), null, `lenguaje sin registrar: ${lang}`);
  const h = highlight('<?php echo "<b>";', 'php');
  assert.ok(h.includes('class="hljs-meta"') && h.includes('&lt;b&gt;') && !h.includes('<b>'));
  assert.equal(highlight('x', 'inventado'), null);
});

test('sustituto de entities (build): conocidas, desconocidas y formato', async () => {
  const { decodeHTML, decodeHTMLStrict } = await import('../src/shims/entities.js');
  assert.equal(decodeHTML('&copy;'), '©');
  assert.equal(decodeHTMLStrict('&ntilde;'), 'ñ');
  assert.equal(decodeHTML('&nbsp;'), '\u00a0');
  assert.equal(decodeHTML('&noexiste;'), '&noexiste;');
  assert.equal(decodeHTML('&constructor;'), '&constructor;');
  assert.equal(decodeHTML('&copy; y más'), '&copy; y más');
});

// ── Seguridad ─────────────────────────────────────────────────
const XSS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<details open ontoggle=alert(1)>',
  '[a](javascript:alert(1))',
  '[a](JaVaScRiPt:alert(1))',
  '[a](  javascript:alert(1))',
  '[a](vbscript:msgbox(1))',
  '[a](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
  '![a](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)',
  '[a](//evil.example/x)',
  '<javascript:alert(1)>',
  '![x" onerror="alert(1)](a.png)',
  '[a](/x"onmouseover="alert(1))',
  '[a](a.png "t\\" onmouseover=\\"alert(1)")',
  '```"><img src=x onerror=alert(1)>\ncode\n```',
  '> [!NOTE]\n> <img src=x onerror=alert(1)>',
  '- [ ] <script>alert(1)</script>',
  '| <b>x</b> |\n|---|\n| <svg onload=alert(1)> |',
  'x[^<img src=x onerror=alert(1)>]\n\n[^<img src=x onerror=alert(1)>]: y',
];
test('XSS: nada ejecutable sale del Markdown', () => {
  for (const src of XSS) {
    const h = md(src);
    assert.ok(!/<(script|svg|details|iframe|object)/i.test(h), `etiqueta peligrosa: ${src}\n→ ${h}`);
    // Atributos reales on*: fuera de los valores entrecomillados (que van escapados)
    const tags = (h.match(/<[a-z][^>]*>/gi) || []).map(tag => tag.replace(/"[^"]*"/g, '""'));
    assert.ok(!tags.some(tag => /\son\w+\s*=/i.test(tag)), `atributo on*: ${src}\n→ ${h}`);
    assert.ok(!/(href|src)="\s*(javascript|vbscript|data):/i.test(h), `esquema peligroso: ${src}\n→ ${h}`);
    assert.ok(!/(href|src)="\/\//.test(h), `URL relativa al protocolo: ${src}\n→ ${h}`);
  }
});
