// ─── Editor de posts ───────────────────────────────────────────
// Carga siempre el post completo por id (el listado no trae el cuerpo), con:
//   vista dividida en vivo, barra de herramientas y atajos, imágenes desde
//   Multimedia o pegadas/arrastradas, borrador local y aviso de cambios sin guardar.
import { api, uploadMedia } from './admin-api.js';

const { useState, useEffect, useMemo, useRef, useDeferredValue } = React;

// ── Utilidades ────────────────────────────────────────────────
const localDate = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const slugify = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 60).replace(/-+$/, '');

const emptyForm = () => ({ id: '', title: '', body: '', excerpt: '', category_id: '', status: 'draft', date: localDate(), tags: '' });
const fromPost = (p) => ({
  id: p.id, title: p.title || '', body: p.body || '', excerpt: p.excerpt || '',
  category_id: p.category_id || '', status: p.status || 'draft',
  date: String(p.date || '').slice(0, 10) || localDate(), tags: (p.tags || []).join(', '),
});
const snap = (f) => JSON.stringify(f);

// Borrador local por post ("nuevo" para uno sin guardar todavía)
const draftKey = (id) => `jr-draft-${id || 'nuevo'}`;
const readDraft = (id) => { try { return JSON.parse(localStorage.getItem(draftKey(id)) || 'null'); } catch { return null; } };
const writeDraft = (id, form) => { try { localStorage.setItem(draftKey(id), JSON.stringify({ form, ts: Date.now() })); } catch {} };
const clearDraft = (id) => { try { localStorage.removeItem(draftKey(id)); } catch {} };

const fmtTime = (ts) => new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const truncate = (t, n) => {
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n * 0.6)).replace(/[\s,.;:]+$/, '') + '…';
};

// ── Edición del textarea ──────────────────────────────────────
// Usa execCommand('insertText') cuando el textarea tiene el foco: así el
// deshacer (Ctrl+Z) del navegador sigue funcionando. Si no, setRangeText + evento input.
function replaceRange(ta, start, end, text, selStart = text.length, selEnd = selStart) {
  ta.focus();
  ta.setSelectionRange(start, end);
  let ok = false;
  if (document.activeElement === ta) {
    try { ok = text ? document.execCommand('insertText', false, text) : (start === end || document.execCommand('delete')); } catch {}
  }
  if (!ok) {
    ta.setRangeText(text, start, end, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  ta.setSelectionRange(start + selStart, start + selEnd);
}

function wrapSelection(ta, before, after, placeholder) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e);
  // Si ya está envuelto, lo desenvuelve
  if (sel && value.slice(s - before.length, s) === before && value.slice(e, e + after.length) === after) {
    replaceRange(ta, s - before.length, e + after.length, sel, 0, sel.length);
    return;
  }
  const inner = sel || placeholder;
  replaceRange(ta, s, e, before + inner + after, before.length, before.length + inner.length);
}

// Aplica fn a las líneas completas que toca la selección
function transformLines(ta, fn) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const a = value.lastIndexOf('\n', s - 1) + 1;
  const endFrom = e > s && value[e - 1] === '\n' ? e - 1 : e;
  let b = value.indexOf('\n', endFrom);
  if (b === -1) b = value.length;
  const old = value.slice(a, b);
  const out = fn(old.split('\n')).join('\n');
  if (s === e) {
    const caret = Math.max(0, Math.min(out.length, s - a + out.length - old.length));
    replaceRange(ta, a, b, out, caret, caret);
  } else {
    replaceRange(ta, a, b, out, 0, out.length);
  }
}

const HEADING = /^#{1,6}\s+/;
const ANY_MARK = /^(\s*)(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/;
const LIST_RE = {
  ul: /^\s*[-*+]\s+(?!\[[ xX]\]\s)/,
  ol: /^\s*\d+[.)]\s+/,
  task: /^\s*[-*+]\s+\[[ xX]\]\s+/,
  quote: /^>\s?/,
};

function setHeading(ta, level) {
  transformLines(ta, lines => lines.map(l => {
    const cur = (l.match(/^(#{1,6})\s/) || [])[1];
    const bare = l.replace(HEADING, '');
    return cur && cur.length === level ? bare : '#'.repeat(level) + ' ' + bare;
  }));
}

function toggleList(ta, kind) {
  transformLines(ta, lines => {
    const full = lines.filter(l => l.trim());
    if (full.length && full.every(l => LIST_RE[kind].test(l))) {
      return lines.map(l => (kind === 'quote' ? l.replace(LIST_RE.quote, '') : l.replace(ANY_MARK, '$1')));
    }
    let n = 0;
    return lines.map(l => {
      if (!l.trim() && lines.length > 1) return l;
      if (kind === 'quote') return '> ' + l;
      const m = l.match(ANY_MARK);
      const indent = m ? m[1] : '';
      const bare = m ? l.slice(m[0].length) : l;
      const mark = kind === 'ul' ? '- ' : kind === 'task' ? '- [ ] ' : `${++n}. `;
      return indent + mark + bare;
    });
  });
}

// Inserta un bloque separado por líneas en blanco
function insertBlock(ta, block, selA = block.length, selB = selA) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const before = value.slice(0, s), after = value.slice(e);
  const pre = !before ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const post = !after ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  replaceRange(ta, s, e, pre + block + post, pre.length + selA, pre.length + selB);
}

function insertLink(ta) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e);
  if (/^(https?:\/\/|mailto:)\S+$/.test(sel)) { replaceRange(ta, s, e, `[](${sel})`, 1, 1); return; }
  if (sel) { replaceRange(ta, s, e, `[${sel}](https://)`, sel.length + 3, sel.length + 11); return; }
  replaceRange(ta, s, e, '[texto](https://)', 1, 6);
}

function insertCodeBlock(ta) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  const sel = value.slice(s, e).replace(/\n$/, '');
  insertBlock(ta, '```\n' + sel + '\n```', 3, 3); // cursor tras ``` para escribir el lenguaje
}

const TABLE = '| Columna | Columna |\n| --- | --- |\n| celda | celda |';

// Tab / Shift+Tab: indenta o desindenta las líneas (o inserta dos espacios)
function indent(ta, out) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  if (!out && s === e) {
    const ls = value.lastIndexOf('\n', s - 1) + 1;
    if (!ANY_MARK.test(value.slice(ls)) && !/^\s*>/.test(value.slice(ls))) { replaceRange(ta, s, s, '  '); return; }
  }
  transformLines(ta, lines => lines.map(l => (out ? l.replace(/^( {1,2}|\t)/, '') : '  ' + l)));
}

// Enter: continúa listas y citas; en un elemento vacío, termina la lista
function continueList(ta) {
  const { selectionStart: s, selectionEnd: e, value } = ta;
  if (s !== e) return false;
  const ls = value.lastIndexOf('\n', s - 1) + 1;
  if (((value.slice(0, ls).match(/^\s*```/gm) || []).length) % 2) return false; // dentro de un bloque de código
  let le = value.indexOf('\n', s);
  if (le === -1) le = value.length;
  const line = value.slice(ls, le);
  const lm = line.match(/^(\s*)(?:([-*+])|(\d+)([.)]))\s+(\[[ xX]\]\s+)?/);
  const qm = !lm && line.match(/^(?:>\s?)+/);
  const marker = lm ? lm[0] : qm ? qm[0] : null;
  if (!marker || s < ls + marker.length) return false;
  if (!line.slice(marker.length).trim()) {
    replaceRange(ta, ls, le, '', 0, 0);
    return true;
  }
  let next;
  if (qm) next = qm[0];
  else {
    const [, ind, bullet, num, delim, task] = lm;
    next = ind + (bullet || `${+num + 1}${delim}`) + ' ' + (task ? '[ ] ' : '');
  }
  replaceRange(ta, s, s, '\n' + next);
  return true;
}

// ── Chuleta ───────────────────────────────────────────────────
const HELP = [
  ['## Sección / ### Subsección', 'Encabezados (# y ## se muestran igual: el título del post ya es el principal)'],
  ['**negrita**  *cursiva*  ~~tachado~~', 'Énfasis'],
  ['`código`', 'Código en línea'],
  ['```bash\ncomando\n```', 'Bloque de código con resaltado (bash, js, ts, php, python, rust, c, cpp, go, sql, json, yaml, ini, diff, css, html, dockerfile, makefile, nginx, apache)'],
  ['- elemento\n  - anidado\n1. numerado', 'Listas (Tab / Shift+Tab indenta)'],
  ['- [ ] pendiente\n- [x] hecho', 'Lista de tareas'],
  ['> cita', 'Cita'],
  ['> [!NOTE]\n> texto', 'Aviso: NOTE, TIP, IMPORTANT, WARNING, CAUTION'],
  ['[texto](https://…)', 'Enlace (los externos se abren en otra pestaña)'],
  ['![descripción](uploads/media/…)', 'Imagen; con "Pie de foto" tras la URL se muestra como figura'],
  ['| a | b |\n| --- | :-: |\n| 1 | 2 |', 'Tabla (":" alinea la columna)'],
  ['texto[^1]\n\n[^1]: nota', 'Nota al pie'],
  ['---', 'Separador'],
];
const KEYS = [
  ['Ctrl+B / Ctrl+I', 'Negrita / cursiva'], ['Ctrl+K', 'Enlace'], ['Ctrl+E', 'Código en línea'],
  ['Ctrl+S', 'Guardar'], ['Enter', 'Continúa la lista (en un elemento vacío, la termina)'],
  ['Esc y luego Tab', 'Salir del editor con el teclado'],
];

// ── Selector de Multimedia ────────────────────────────────────
function MediaPicker({ onPick, onUpload, onClose }) {
  const [files, setFiles] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => {
    api('/media').then(r => setFiles(r.ok ? (r.data || []).filter(m => /^image\//.test(m.mime_type || 'image/')) : []))
      .catch(() => setFiles([]));
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="ed-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ed-modal" role="dialog" aria-modal="true" aria-label="Insertar imagen">
        <div className="ed-modal-head">
          Insertar imagen
          <button className="btn sm" onClick={() => inputRef.current?.click()}>Subir desde el equipo…</button>
          <button className="btn sm" onClick={onClose} aria-label="Cerrar">✕</button>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { onUpload(e.target.files); onClose(); }} />
        </div>
        <div className="ed-modal-body">
          {files === null && <div className="page-sub">Cargando…</div>}
          {files && files.length === 0 && <div className="page-sub">No hay imágenes en Multimedia todavía. Súbelas con el botón de arriba, o pégalas o arrástralas directamente en el editor.</div>}
          {files && files.length > 0 && (
            <div className="ed-media-grid">
              {files.map(m => (
                <button key={m.id} className="ed-media-opt" onClick={() => onPick(m)} title={m.original_name}>
                  <img src={m.url} alt="" loading="lazy" />
                  <span>{m.original_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const altFromName = (name) => String(name || 'imagen').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/[\[\]]/g, '').trim() || 'imagen';

// ── Editor ────────────────────────────────────────────────────
export function Editor({ postId, onBack, registerGuard }) {
  const [savedId, setSavedId] = useState(postId || null);
  const [form, setForm] = useState(null);           // null mientras carga
  const [savedSnap, setSavedSnap] = useState('');
  const [loadError, setLoadError] = useState('');
  const [cats, setCats] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);             // { type: ok|error|warn, text }
  const [draftOffer, setDraftOffer] = useState(null);
  const [draftAt, setDraftAt] = useState(null);
  const [slugTouched, setSlugTouched] = useState(!!postId);
  const [mode, setMode] = useState(() => (window.matchMedia('(min-width: 1200px)').matches ? 'split' : 'edit'));
  const [picker, setPicker] = useState(false);
  const [help, setHelp] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState(0);

  const taRef = useRef(null);
  const previewRef = useRef(null);
  const selRef = useRef([0, 0]);
  const escRef = useRef(false);

  const dirty = form !== null && snap(form) !== savedSnap;

  // Referencias al estado actual para los listeners globales
  const live = useRef({});
  live.current = { form, dirty, savedId, saving };

  // ── Carga ──
  useEffect(() => {
    api('/categories').then(r => { if (r.ok) setCats(r.data || []); }).catch(() => {});
    const init = (f) => {
      setForm(f);
      setSavedSnap(snap(f));
      const d = readDraft(postId);
      if (d?.form && snap(d.form) !== snap(f)) setDraftOffer(d);
    };
    if (!postId) { init(emptyForm()); return; }
    api(`/posts/${encodeURIComponent(postId)}`)
      .then(r => { if (r.ok) init(fromPost(r.data)); else setLoadError(r.error || 'No se pudo cargar el post'); })
      .catch(() => setLoadError('No se pudo conectar con el servidor'));
  }, [postId]);

  // ── Aviso al salir con cambios ──
  useEffect(() => {
    registerGuard?.(() => live.current.dirty);
    const onUnload = (e) => { if (live.current.dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onUnload);
    return () => { window.removeEventListener('beforeunload', onUnload); registerGuard?.(null); };
  }, []);

  // ── Borrador local (cada 1,5 s de inactividad) ──
  useEffect(() => {
    if (!form || draftOffer) return;
    if (!dirty) { clearDraft(savedId); setDraftAt(null); return; }
    const t = setTimeout(() => { writeDraft(savedId, form); setDraftAt(Date.now()); }, 1500);
    return () => clearTimeout(t);
  }, [form, dirty, savedId, draftOffer]);

  // ── Ctrl+S en toda la página ──
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Vista previa (diferida para no frenar la escritura) ──
  const deferredBody = useDeferredValue(form?.body || '');
  const preview = useMemo(() => {
    const env = {};
    const html = window.renderMarkdown(deferredBody, env);
    return { html, external: (env.images || []).filter(u => /^https?:\/\//i.test(u)) };
  }, [deferredBody]);

  useEffect(() => { window.highlightCode(previewRef.current); }, [preview.html, mode]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setTitle = (v) => setForm(f => ({ ...f, title: v, ...(!savedId && !slugTouched ? { id: slugify(v) } : {}) }));

  // ── Guardar ──
  const save = async (forceEmpty = false) => {
    const { form: f, savedId: id, saving: busy } = live.current;
    if (!f || busy) return;
    if (!f.title.trim() || !f.category_id) { setMsg({ type: 'error', text: 'Falta el título o la categoría.' }); return; }
    setSaving(true); setMsg(null);
    const payload = {
      title: f.title.trim(), body: f.body, excerpt: f.excerpt.trim(), category_id: f.category_id,
      status: f.status, date: f.date, tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    if (!id && f.id.trim()) payload.id = f.id.trim();
    if (forceEmpty) payload.force_empty_body = true;
    let r;
    try {
      r = id
        ? await api(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api('/posts', { method: 'POST', body: JSON.stringify(payload) });
    } catch {
      setSaving(false);
      setMsg({ type: 'error', text: 'No se pudo conectar con el servidor. Tus cambios siguen en el borrador local.' });
      return;
    }
    setSaving(false);
    if (r.ok) {
      const newId = id || r.data.id;
      clearDraft(id); clearDraft(null);
      const nf = { ...f, id: newId };
      setForm(nf); setSavedSnap(snap(nf)); setSavedId(newId); setDraftAt(null);
      setMsg({ type: 'ok', text: id ? '✓ Guardado' : '✓ Post creado' });
      setTimeout(() => setMsg(m => (m?.type === 'ok' ? null : m)), 2500);
    } else if (r.httpStatus === 409 && id && !forceEmpty) {
      if (confirm('El contenido está vacío y el post guardado no lo está. ¿Guardar el post sin contenido?')) save(true);
    } else {
      setMsg({ type: 'error', text: r.error || 'Error al guardar' });
    }
  };

  // ── Imágenes ──
  const uploadFiles = async (fileList) => {
    const files = [...(fileList || [])].filter(f => /^image\//.test(f.type));
    if (!files.length) return;
    const ta = taRef.current;
    for (const file of files) {
      const alt = altFromName(file.name);
      const tag = `![Subiendo ${alt}… ${Math.random().toString(36).slice(2, 7)}]()`;
      replaceRange(ta, ta.selectionStart, ta.selectionEnd, tag);
      setUploads(n => n + 1);
      let res;
      try { res = await uploadMedia(file); } catch { res = { ok: false, error: 'No se pudo conectar con el servidor' }; }
      setUploads(n => n - 1);
      // Sustituye el marcador conservando el cursor del usuario
      const idx = ta.value.indexOf(tag);
      if (idx === -1) continue;
      const [ss, se] = [ta.selectionStart, ta.selectionEnd];
      const text = res.ok ? `![${alt}](${res.data.url})` : '';
      replaceRange(ta, idx, idx + tag.length, text);
      const shift = (p) => (p > idx ? p + text.length - tag.length : p);
      ta.setSelectionRange(shift(ss), shift(se));
      if (!res.ok) setMsg({ type: 'error', text: `No se pudo subir «${file.name}»: ${res.error || 'error desconocido'}` });
    }
  };

  const openPicker = () => {
    const ta = taRef.current;
    selRef.current = [ta.selectionStart, ta.selectionEnd];
    setPicker(true);
  };
  const pickImage = (m) => {
    setPicker(false);
    const ta = taRef.current;
    const [s, e] = selRef.current;
    ta.focus();
    ta.setSelectionRange(s, e);
    const alt = ta.value.slice(s, e).trim() || altFromName(m.original_name);
    replaceRange(ta, s, e, `![${alt}](${m.url})`);
  };

  // ── Teclado en el textarea ──
  const onKeyDown = (e) => {
    const ta = e.currentTarget;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { escRef.current = true; return; }
    if (e.key === 'Tab') {
      if (escRef.current) { escRef.current = false; return; } // deja salir con el teclado
      e.preventDefault(); indent(ta, e.shiftKey); return;
    }
    escRef.current = false;
    if (mod && !e.altKey && !e.shiftKey) {
      const act = { b: () => wrapSelection(ta, '**', '**', 'negrita'), i: () => wrapSelection(ta, '*', '*', 'cursiva'), k: () => insertLink(ta), e: () => wrapSelection(ta, '`', '`', 'código') }[e.key.toLowerCase()];
      if (act) { e.preventDefault(); act(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !mod && !e.nativeEvent.isComposing && continueList(ta)) e.preventDefault();
  };

  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type));
    if (files.length) { e.preventDefault(); uploadFiles(files); }
  };
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  const onDrop = (e) => {
    setDragging(false);
    if (!hasFiles(e)) return;
    e.preventDefault();
    const ta = taRef.current;
    ta.focus();
    uploadFiles(e.dataTransfer.files);
  };

  // Desplazamiento sincronizado editor → vista previa (por proporción)
  const onScroll = (e) => {
    const p = previewRef.current;
    if (mode !== 'split' || !p) return;
    const ta = e.currentTarget;
    const r = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
    p.scrollTop = r * (p.scrollHeight - p.clientHeight);
  };

  const excerptFromBody = () => {
    const doc = new DOMParser().parseFromString(window.renderMarkdown(form.body), 'text/html');
    const p = [...doc.querySelectorAll('p')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).find(Boolean) || '';
    if (p) set('excerpt', truncate(p, 220));
  };

  // ── Render ──
  if (loadError) {
    return (
      <>
        <div className="page-header"><div><h1 className="page-title">Editar post</h1></div>
          <div className="page-actions"><button className="btn" onClick={onBack}>← Volver</button></div></div>
        <div className="ed-banner error" role="alert">{loadError}</div>
      </>
    );
  }
  if (!form) return <div className="page-sub">Cargando post…</div>;

  const words = form.body.trim() ? form.body.trim().split(/\s+/).length : 0;
  const tool = (label, title, fn, content) => (
    <button type="button" className="ed-tb" title={title} aria-label={label} disabled={mode === 'preview'}
      onMouseDown={e => e.preventDefault()} onClick={() => fn(taRef.current)}>{content || label}</button>
  );

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">{savedId ? 'Editar post' : 'Nuevo post'}</h1></div>
        <div className="page-actions">
          {dirty && !saving && <span className="ed-dirty">Cambios sin guardar</span>}
          <button className="btn" onClick={onBack}>← Volver</button>
          {savedId && form.status === 'published' && (
            <a className="btn" href={`index.html#/post/${encodeURIComponent(savedId)}`} target="_blank" rel="noopener">Ver en el sitio ↗</a>
          )}
          <button className="btn primary" onClick={() => save()} disabled={saving || !dirty} title="Ctrl+S">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>

      {draftOffer && (
        <div className="ed-banner warn" role="status">
          Hay un borrador local de este post del {fmtTime(draftOffer.ts)} con cambios que no se guardaron.
          <span className="push">
            <button className="btn sm" onClick={() => { setForm(draftOffer.form); setDraftOffer(null); }}>Restaurar borrador</button>
            <button className="btn sm" onClick={() => { clearDraft(postId); setDraftOffer(null); }}>Descartar</button>
          </span>
        </div>
      )}
      {msg && <div className={`ed-banner ${msg.type}`} role={msg.type === 'error' ? 'alert' : 'status'}>{msg.text}</div>}

      <div className="ed-layout">
        <div>
          <div className="form-group">
            <label className="form-label" htmlFor="ed-title">Título</label>
            <input id="ed-title" className="form-input ed-title" value={form.title} maxLength={300} onChange={e => setTitle(e.target.value)} placeholder="Título del post" />
          </div>

          <div className="ed-toolbar" role="toolbar" aria-label="Formato">
            {tool('Encabezado de sección', 'Encabezado de sección (##)', ta => setHeading(ta, 2), 'H2')}
            {tool('Subsección', 'Subsección (###)', ta => setHeading(ta, 3), 'H3')}
            <span className="ed-sep" />
            {tool('Negrita', 'Negrita (Ctrl+B)', ta => wrapSelection(ta, '**', '**', 'negrita'), <b>B</b>)}
            {tool('Cursiva', 'Cursiva (Ctrl+I)', ta => wrapSelection(ta, '*', '*', 'cursiva'), <i>I</i>)}
            {tool('Tachado', 'Tachado', ta => wrapSelection(ta, '~~', '~~', 'tachado'), <s>S</s>)}
            {tool('Código en línea', 'Código en línea (Ctrl+E)', ta => wrapSelection(ta, '`', '`', 'código'), '`c`')}
            <span className="ed-sep" />
            {tool('Lista', 'Lista', ta => toggleList(ta, 'ul'), '•')}
            {tool('Lista numerada', 'Lista numerada', ta => toggleList(ta, 'ol'), '1.')}
            {tool('Lista de tareas', 'Lista de tareas', ta => toggleList(ta, 'task'), '☐')}
            {tool('Cita', 'Cita', ta => toggleList(ta, 'quote'), '❝')}
            {tool('Aviso', 'Aviso (> [!NOTE])', ta => insertBlock(ta, '> [!NOTE]\n> texto', 12, 17), 'ⓘ')}
            <span className="ed-sep" />
            {tool('Enlace', 'Enlace (Ctrl+K)', insertLink, '🔗')}
            {tool('Imagen', 'Imagen de Multimedia (o pega / arrastra una)', openPicker, '🖼')}
            {tool('Bloque de código', 'Bloque de código', insertCodeBlock, '{ }')}
            {tool('Tabla', 'Tabla', ta => insertBlock(ta, TABLE, 2, 9), '▦')}
            {tool('Separador', 'Separador', ta => insertBlock(ta, '---'), '―')}
            <div className="ed-modes" role="group" aria-label="Vista">
              {[['edit', 'Editar'], ['split', 'Dividida'], ['preview', 'Vista previa']].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>
              ))}
            </div>
            <button type="button" className="ed-tb" aria-expanded={help} title="Chuleta de Markdown y atajos" onClick={() => setHelp(h => !h)}>?</button>
          </div>

          <div
            className={`ed-panes${mode === 'split' ? ' split' : ''}${dragging ? ' dragging' : ''}`}
            onDragOver={e => { if (hasFiles(e)) { e.preventDefault(); setDragging(true); } }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
            onDrop={onDrop}
          >
            <textarea
              ref={taRef}
              className="ed-text"
              style={mode === 'preview' ? { display: 'none' } : undefined}
              value={form.body}
              onChange={e => set('body', e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              onScroll={onScroll}
              spellCheck
              aria-label="Contenido en Markdown"
              placeholder={'Escribe en Markdown…\n\n## Una sección\n\nTexto con **negrita** y `código`.\n\nPega o arrastra imágenes aquí para subirlas.'}
            />
            {mode !== 'edit' && (
              <div
                ref={previewRef}
                className="md-preview md"
                aria-label="Vista previa"
                onClick={e => window.handleMarkdownClick(e)}
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            )}
          </div>

          <div className="ed-status" aria-live="polite">
            <span>{words.toLocaleString('es-ES')} palabras</span>
            <span>{window.readingTime(form.body)} min de lectura</span>
            {uploads > 0 && <span>subiendo {uploads} imagen{uploads > 1 ? 'es' : ''}…</span>}
            {draftAt && <span>borrador local {fmtTime(draftAt)}</span>}
            {preview.external.length > 0 && (
              <span className="warn">
                ⚠ {preview.external.length} imagen{preview.external.length > 1 ? 'es' : ''} de otro dominio: el sitio no las mostrará (la política de seguridad solo permite imágenes propias). Súbelas a Multimedia.
              </span>
            )}
          </div>

          {help && (
            <div className="card ed-help">
              <table><tbody>{HELP.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
              <table style={{ marginTop: 12 }}><tbody>{KEYS.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>)}</tbody></table>
            </div>
          )}
        </div>

        <div>
          <div className="form-group">
            <label className="form-label" htmlFor="ed-cat">Categoría</label>
            <select id="ed-cat" className="form-input form-select" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              <option value="">Seleccionar…</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ed-status">Estado</label>
            <select id="ed-status" className="form-input form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="scheduled">Programado</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ed-date">Fecha</label>
            <input id="ed-date" className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ed-slug">Slug / ID</label>
            {savedId ? (
              <>
                <input id="ed-slug" className="form-input" value={savedId} readOnly />
                <div className="form-hint">No se puede cambiar una vez creado el post.</div>
              </>
            ) : (
              <>
                <input id="ed-slug" className="form-input" value={form.id} maxLength={60}
                  onChange={e => { setSlugTouched(true); set('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); }}
                  placeholder="se-genera-del-titulo" />
                <div className="form-hint">Se genera del título. Solo a-z, 0-9 y guiones.</div>
              </>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ed-tags">Tags</label>
            <input id="ed-tags" className="form-input" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="linux, kernel, rust" />
            <div className="form-hint">Separados por comas</div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ed-excerpt">Extracto</label>
            <textarea id="ed-excerpt" className="form-input" style={{ minHeight: 90, resize: 'vertical' }} value={form.excerpt} onChange={e => set('excerpt', e.target.value)} placeholder="Breve descripción del post…" />
            <button type="button" className="btn sm" style={{ marginTop: 6 }} onClick={excerptFromBody} disabled={!form.body.trim()}>Generar desde el contenido</button>
          </div>
        </div>
      </div>

      {picker && <MediaPicker onPick={pickImage} onUpload={uploadFiles} onClose={() => setPicker(false)} />}
    </>
  );
}
