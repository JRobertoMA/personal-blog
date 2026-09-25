// ─── Notas: sintaxis por líneas ────────────────────────────────
// Compartido por la ventana "Notas" del escritorio y la vista previa del panel.
//   # título   → encabezado con ★ ({hoy} se sustituye por la fecha del día)
//   - texto    → elemento de lista "· texto"
//   > texto    → anotación "a mano" (gris)
//   (vacía)    → espacio
// Devuelve datos, no HTML: quien lo pinte usa React y el texto va escapado.
(function() {
function parseNotes(text, today) {
  const date = today || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return String(text || '').replace(/\r\n?/g, '\n').split('\n').map(raw => {
    const line = raw.replace(/\{hoy\}/gi, date);
    const t = line.trim();
    if (!t) return { type: 'blank', text: '' };
    let m;
    if ((m = t.match(/^#+\s*(.*)$/)))   return { type: 'star', text: m[1] };
    if ((m = t.match(/^[-*·]\s*(.*)$/))) return { type: 'item', text: m[1] };
    if ((m = t.match(/^>\s?(.*)$/)))    return { type: 'scribble', text: m[1] };
    return { type: 'text', text: t };
  });
}

// Prefijo visual de cada tipo de línea
const NOTE_PREFIX = { star: '★ ', item: '· ', scribble: '· ', text: '', blank: '' };

window.parseNotes = parseNotes;
window.NOTE_PREFIX = NOTE_PREFIX;
})();
