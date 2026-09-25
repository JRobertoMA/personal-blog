// Sustituto ligero del paquete `entities` para markdown-it (build.mjs lo aplica con alias).
// markdown-it solo lo usa para decodificar UNA entidad con nombre ("&copy;"); los
// numéricos ("&#169;") los resuelve él mismo. El paquete completo añadía ~75 KB al
// bundle con las 2 000+ entidades de HTML5; aquí van las que se escriben de verdad.
// Una entidad desconocida se devuelve igual y se muestra como texto literal.
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '­',
  copy: '©', reg: '®', trade: '™', deg: '°', plusmn: '±', times: '×', divide: '÷',
  middot: '·', bull: '•', hellip: '…', ndash: '–', mdash: '—', minus: '−',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', sbquo: '‚', bdquo: '„',
  iexcl: '¡', iquest: '¿', sect: '§', para: '¶', dagger: '†', Dagger: '‡', permil: '‰',
  euro: '€', pound: '£', yen: '¥', cent: '¢', curren: '¤',
  larr: '←', rarr: '→', uarr: '↑', darr: '↓', harr: '↔', lArr: '⇐', rArr: '⇒', hArr: '⇔',
  le: '≤', ge: '≥', ne: '≠', asymp: '≈', equiv: '≡', infin: '∞', sum: '∑', prod: '∏', radic: '√',
  micro: 'µ', frac12: '½', frac14: '¼', frac34: '¾', sup1: '¹', sup2: '²', sup3: '³', ordf: 'ª', ordm: 'º',
  check: '✓', cross: '✗', star: '☆', starf: '★', hearts: '♥', spades: '♠', clubs: '♣', diams: '♦',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', omega: 'ω',
  Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Pi: 'Π',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
  ccedil: 'ç', Ccedil: 'Ç', agrave: 'à', egrave: 'è', ouml: 'ö', auml: 'ä', szlig: 'ß',
  zwj: '‍', zwnj: '‌', thinsp: ' ', ensp: ' ', emsp: ' ',
};

const decode = (str) => {
  const m = /^&([A-Za-z][A-Za-z0-9]*);$/.exec(str);
  return m && Object.prototype.hasOwnProperty.call(NAMED, m[1]) ? NAMED[m[1]] : str;
};

export const decodeHTML = decode;
export const decodeHTMLStrict = decode;
