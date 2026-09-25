// ─── Resaltado de sintaxis (bundle aparte: assets/hljs.js) ─────
// Se descarga solo cuando un post tiene bloques de código (ver highlightCode en
// markdown.js). Para añadir un lenguaje: importarlo aquí y añadir sus nombres a
// HL_LANGS en markdown.js.
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import shell from 'highlight.js/lib/languages/shell';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import ini from 'highlight.js/lib/languages/ini';
import diff from 'highlight.js/lib/languages/diff';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import makefile from 'highlight.js/lib/languages/makefile';
import nginx from 'highlight.js/lib/languages/nginx';
import apache from 'highlight.js/lib/languages/apache';

Object.entries({
  bash, shell, javascript, typescript, php, python, rust, c, cpp, go, sql, json,
  yaml, ini, diff, css, xml, dockerfile, makefile, nginx, apache,
}).forEach(([name, lang]) => hljs.registerLanguage(name, lang));

// Devuelve HTML escapado con <span class="hljs-…">, o null si no conoce el lenguaje
const highlight = (code, lang) =>
  (hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value : null);

if (typeof window !== 'undefined') window.jrHighlight = highlight;
export default highlight;
