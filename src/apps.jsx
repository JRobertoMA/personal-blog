// ─── App Components ────────────────────────────────────────────
(function() {
const { useState: useS, useEffect, useRef, useMemo } = React;

const md = (text) => window.renderMarkdown(text);

// ── Carga del post completo ────────────────────────────────────
// GET /api/posts no incluye el cuerpo; se pide bajo demanda y se cachea.
const postCache = {};
function usePost(id) {
  const summary = (window.BLOG_POSTS || []).find(p => p.id === id) || null;
  const [state, setState] = useS(() => ({ post: postCache[id] || null, loading: !postCache[id], error: null }));

  useEffect(() => {
    if (!id) return;
    if (postCache[id]) { setState({ post: postCache[id], loading: false, error: null }); return; }
    let alive = true;
    setState({ post: null, loading: true, error: null });
    fetch(`api/posts/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(res => {
        if (!alive) return;
        if (res.ok) { postCache[id] = res.data; setState({ post: res.data, loading: false, error: null }); }
        else setState({ post: null, loading: false, error: res.error || 'Post no encontrado' });
      })
      .catch(() => alive && setState({ post: null, loading: false, error: 'No se pudo cargar el post' }));
    return () => { alive = false; };
  }, [id]);

  return { ...state, post: state.post ? { ...summary, ...state.post } : summary };
}

// Cuenta una visita por post y por sesión del navegador
function trackView(id) {
  if (!id) return;
  const key = 'jr-viewed-' + id;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) {}
  fetch(`api/posts/${encodeURIComponent(id)}/view`, { method: 'POST' }).catch(() => {});
}

const CAT_COLORS = {
  linux:     '#39ff14',
  dev:       '#00f0ff',
  hardware:  '#ff00d4',
  seguridad: '#ffb800',
  retro:     '#ff4500',
  filosofia: '#a855f7',
};

// ── Reader App ─────────────────────────────────────────────────
function ReaderApp({ onOpenComments }) {
  const posts = window.BLOG_POSTS || [];
  const [currentId, setCurrentId] = useS(posts[0]?.id || null);
  const { post, loading } = usePost(currentId);

  useEffect(() => { trackView(currentId); }, [currentId]);

  return (
    <div className="reader-layout">
      <div className="reader-sidebar">
        <div className="reader-sidebar-head">~/posts</div>
        {posts.map(p => (
          <div
            key={p.id}
            className={`reader-post-item${currentId === p.id ? ' active' : ''}`}
            onClick={() => setCurrentId(p.id)}
          >
            {p.title.length > 26 ? p.title.slice(0, 26) + '…' : p.title}
          </div>
        ))}
      </div>
      <div className="app" style={{ flex: 1 }}>
        {post ? (
          <>
            <h1>{post.title}</h1>
            <div className="meta">
              {post.date} · {(post.tags || []).map(t => <span key={t} className="tag-pill">#{t}</span>)}
            </div>
            {loading && !post.body
              ? <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>cargando…</div>
              : <div className="post-body" dangerouslySetInnerHTML={{ __html: md(post.body) }} />}
            <h2>// fin</h2>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>
              ─── Gracias por leer. — {window.aboutInitials()}
            </p>
            {onOpenComments && (
              <div style={{ marginTop: 8 }}>
                <button className="btn-neon" onClick={() => onOpenComments(post.id)}>
                  Comentarios ({post.comment_count || 0})
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>Selecciona un post</div>
        )}
      </div>
    </div>
  );
}

// ── Comments Section ───────────────────────────────────────────
function CommentsApp({ postId, showPostTitle = true }) {
  const [comments, setComments] = useS([]);
  const [name,  setName]  = useS(() => localStorage.getItem('jr-comment-name')  || '');
  const [email, setEmail] = useS(() => localStorage.getItem('jr-comment-email') || '');
  const [body,  setBody]  = useS('');
  const [status, setStatus] = useS('idle');
  const tsRef = useRef(Date.now());

  // Siempre los de un post concreto: sin post no hay comentarios que mostrar
  const pid = postId;
  const post = (window.BLOG_POSTS || []).find(p => p.id === pid);

  useEffect(() => {
    if (!pid) return;
    fetch(`api/comments?post_id=${encodeURIComponent(pid)}`)
      .then(r => r.json())
      .then(res => { if (res.ok) setComments(res.data); })
      .catch(() => {});
    tsRef.current = Date.now();
  }, [pid]);

  const submit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: pid, author_name: name.trim(),
          author_email: email.trim(), body: body.trim(),
          _hp: '', _ts: Math.floor(tsRef.current / 1000),
        }),
      }).then(r => r.json());
      if (res.ok) {
        setStatus('sent');
        setBody('');
        localStorage.setItem('jr-comment-name', name.trim());
        if (email.trim()) localStorage.setItem('jr-comment-email', email.trim());
      } else {
        setStatus(res.error || 'error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (!pid) {
    return <div className="app-scroll"><div className="comments-section" style={{ color: 'var(--text-faint)', fontSize: 12 }}>Abre un post para ver sus comentarios.</div></div>;
  }

  return (
    <div className="app-scroll">
      <div className="comments-section">
        <h3>Comentarios</h3>
        {showPostTitle && post && <div className="comments-post">sobre «{post.title}»</div>}
        {comments.length === 0 && (
          <div style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 16 }}>
            Sé el primero en comentar.
          </div>
        )}
        {comments.map(c => (
          <div key={c.id} className="comment-item">
            <div className="comment-meta">
              <span className="comment-author">{c.author_name}</span>
              <span className="comment-date">{c.created_at?.slice(0, 10)}</span>
            </div>
            <div className="comment-body" style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
          </div>
        ))}
        {status === 'sent' ? (
          <div style={{ padding: '12px', background: 'rgba(var(--neon-rgb),0.08)', border: '1px solid rgba(var(--neon-rgb),0.2)', borderRadius: 6, fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
            Comentario enviado, pendiente de moderación.
          </div>
        ) : (
          <form className="comment-form" onSubmit={submit}>
            <input value={name}  onChange={e => setName(e.target.value)}  placeholder="Tu nombre" aria-label="Tu nombre" autoComplete="name" maxLength={120} required />
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (opcional, no se publica)" aria-label="Email (opcional)" type="email" autoComplete="email" maxLength={200} />
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Tu comentario…" aria-label="Tu comentario" maxLength={5000} required />
            {typeof status === 'string' && status !== 'idle' && status !== 'sending' && status !== 'sent' && (
              <div style={{ color: 'var(--neon-2)', fontSize: 11 }}>{status}</div>
            )}
            <button type="submit" className="btn-neon" disabled={status === 'sending'}>
              {status === 'sending' ? 'Enviando…' : 'Enviar comentario'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Files App ──────────────────────────────────────────────────
// Ubicaciones: todos · recientes · destacados · categoría. ← → recorren el
// historial de ubicaciones, ↑ vuelve a todos y ⌕ abre la app Buscar.
const FX_RECENT = 5;
const FX_FEATURED = 5;

function FilesApp({ onOpenPost, onOpenApp }) {
  const posts = window.BLOG_POSTS || [];
  const cats  = window.BLOG_CATEGORIES || [];
  const [nav, setNav] = useS({ stack: ['all'], idx: 0 });
  const loc = nav.stack[nav.idx];

  const go = (next) => setNav(n => (n.stack[n.idx] === next ? n
    : { stack: [...n.stack.slice(0, n.idx + 1), next], idx: n.idx + 1 }));
  const back    = () => setNav(n => ({ ...n, idx: Math.max(0, n.idx - 1) }));
  const forward = () => setNav(n => ({ ...n, idx: Math.min(n.stack.length - 1, n.idx + 1) }));

  const byDate = [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));
  let filtered, path;
  if (loc === 'recent') {
    filtered = byDate.slice(0, FX_RECENT); path = 'recientes/';
  } else if (loc === 'featured') {
    filtered = [...posts].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, FX_FEATURED); path = 'destacados/';
  } else if (loc.startsWith('cat:')) {
    const id = loc.slice(4);
    filtered = byDate.filter(p => p.category_id === id); path = id + '/';
  } else {
    filtered = byDate; path = '';
  }

  const item = (id, icon, label, color) => (
    <div className={`item${loc === id ? ' active' : ''}`} onClick={() => go(id)}>
      <span style={color ? { color } : undefined}>{icon}</span>{label}
    </div>
  );

  return (
    <div className="fx">
      <div className="fx-toolbar">
        <button onClick={back} disabled={nav.idx === 0} title="Atrás" aria-label="Atrás">←</button>
        <button onClick={forward} disabled={nav.idx >= nav.stack.length - 1} title="Adelante" aria-label="Adelante">→</button>
        <button onClick={() => go('all')} disabled={loc === 'all'} title="Subir a /posts" aria-label="Subir">↑</button>
        <div className="fx-path">/home/jr/posts/{path}</div>
        {onOpenApp && <button onClick={() => onOpenApp('search')} title="Buscar posts" aria-label="Buscar">⌕</button>}
      </div>
      <div className="fx-main">
        <div className="fx-sidebar">
          <div className="group">Lugares</div>
          {item('all', '📁', 'todos')}
          {item('featured', '⭐', 'destacados')}
          {item('recent', '🕒', 'recientes')}
          <div className="group">Categorías</div>
          {cats.map(c => <React.Fragment key={c.id}>{item('cat:' + c.id, '●', c.label.toLowerCase(), c.color)}</React.Fragment>)}
        </div>
        <div className="fx-list">
          <div className="fx-row header">
            <span></span>
            <span>Nombre</span>
            <span>Categoría</span>
            <span>Fecha</span>
            <span>{loc === 'featured' ? 'Vistas' : 'Tags'}</span>
          </div>
          {filtered.length === 0 && <div className="fx-empty">// carpeta vacía</div>}
          {filtered.map(p => (
            <div key={p.id} className="fx-row" onClick={() => onOpenPost && onOpenPost(p.id)} title="Abrir post">
              <span>📄</span>
              <span className="name">{p.title}.md</span>
              <span>{p.category_label || p.category_id}</span>
              <span>{p.date}</span>
              <span>{loc === 'featured' ? (p.views || 0) : (p.tags || []).length}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="fx-statusbar">
        {filtered.length} archivo(s) · {cats.length} categorías
      </div>
    </div>
  );
}

// ── Post App (ventana individual de post) ──────────────────────
function PostApp({ postId, onOpenComments }) {
  const { post, loading, error } = usePost(postId);

  useEffect(() => { trackView(postId); }, [postId]);

  if (!post && loading) return <div style={{ padding: 24, color: 'var(--text-faint)', fontSize: 13 }}>cargando…</div>;
  if (!post || error) return <div style={{ padding: 24, color: 'var(--text-faint)', fontSize: 13 }}>Post no encontrado.</div>;

  return (
    <div className="app">
      <h1>{post.title}</h1>
      <div className="meta">
        {post.date} · {(post.tags || []).map(t => <span key={t} className="tag-pill">#{t}</span>)}
      </div>
      {loading && !post.body
        ? <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>cargando…</div>
        : <div className="post-body" dangerouslySetInnerHTML={{ __html: md(post.body) }} />}
      <h2>// fin</h2>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>─── Gracias por leer. — {window.aboutInitials()}</p>
      <div style={{ marginTop: 8 }}>
        <button className="btn-neon" onClick={() => onOpenComments && onOpenComments(post.id)}>
          Comentarios ({post.comment_count || 0})
        </button>
      </div>
    </div>
  );
}

// ── Notes App ──────────────────────────────────────────────────
function NotesApp() {
  const [text, setText] = useS(null);
  useEffect(() => {
    fetch('api/notes').then(r => r.json())
      .then(res => setText(res.ok ? res.data.text : ''))
      .catch(() => setText(''));
  }, []);

  if (text === null) return <div className="notes"><div className="scribble">cargando…</div></div>;
  const lines = window.parseNotes(text);
  if (!lines.some(l => l.type !== 'blank')) return <div className="notes"><div className="scribble">// sin notas</div></div>;
  return (
    <div className="notes">
      {lines.map((l, i) => (
        <div key={i} className={l.type === 'star' ? 'star' : l.type === 'scribble' ? 'scribble' : undefined}>
          {l.type === 'blank' ? '\u00a0' : window.NOTE_PREFIX[l.type] + l.text}
        </div>
      ))}
    </div>
  );
}

// ── Tags App ───────────────────────────────────────────────────
// Pulsar un tag o una categoría lista sus posts; pulsar un post lo abre.
function TagsApp({ openPost }) {
  const posts = window.BLOG_POSTS || [];
  const cats  = window.BLOG_CATEGORIES || [];
  const [sel, setSel] = useS(null); // { type: 'tag' | 'cat', value, label }

  const allTags = useMemo(() => {
    const map = {};
    posts.forEach(p => (p.tags || []).forEach(t => { map[t] = (map[t] || 0) + 1; }));
    return Object.entries(map).sort((a,b) => b[1]-a[1]);
  }, [posts]);

  const sizes = [11, 13, 15, 18, 22];
  const max = Math.max(...allTags.map(t => t[1]), 1);
  const toggle = (next) => setSel(s => (s && s.type === next.type && s.value === next.value ? null : next));
  const isSel = (type, value) => sel && sel.type === type && sel.value === value;

  const matches = !sel ? [] : posts.filter(p =>
    sel.type === 'tag' ? (p.tags || []).includes(sel.value) : p.category_id === sel.value);

  return (
    <div className="tags-app">
      <h2>Tags & Categorías</h2>
      <div className="sub">// {allTags.length} tags totales · {cats.length} categorías · pulsa uno para ver sus posts</div>
      <div className="tags-cloud">
        {allTags.map(([tag, count]) => (
          <button key={tag} className={`tag-chip${isSel('tag', tag) ? ' active' : ''}`}
            style={{ fontSize: sizes[Math.min(sizes.length-1, Math.floor((count/max)*sizes.length))] }}
            onClick={() => toggle({ type: 'tag', value: tag, label: '#' + tag })}
            aria-pressed={isSel('tag', tag)}
          >
            #{tag} <span className="count">{count}</span>
          </button>
        ))}
      </div>

      {sel && (
        <div className="tags-results">
          <div className="tags-results-head">
            <span>{sel.label} · {matches.length} post{matches.length !== 1 ? 's' : ''}</span>
            <button onClick={() => setSel(null)} aria-label="Cerrar lista">✕</button>
          </div>
          {matches.map(p => (
            <div key={p.id} className="search-result" onClick={() => openPost && openPost(p.id)}>
              <div className="title">{p.title}</div>
              <div className="meta">{p.date} · {p.category_label || p.category_id}</div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--text)', margin: '0 0 12px' }}>Categorías</h2>
      {cats.map(c => {
        const n = posts.filter(p => p.category_id === c.id).length;
        return (
          <div key={c.id} className={`cat-card${isSel('cat', c.id) ? ' active' : ''}`} style={{ borderLeftColor: c.color || 'var(--neon)' }}
            onClick={() => toggle({ type: 'cat', value: c.id, label: c.label })} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') toggle({ type: 'cat', value: c.id, label: c.label }); }}>
            <div className="name">{c.label} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>· {n} post{n !== 1 ? 's' : ''}</span></div>
            {c.description && <div className="desc">{c.description}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Search App ─────────────────────────────────────────────────
function SearchApp({ openPost }) {
  const posts = window.BLOG_POSTS || [];
  const [q, setQ] = useS('');

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return posts.filter(p =>
      p.title.toLowerCase().includes(ql) ||
      (p.excerpt || '').toLowerCase().includes(ql) ||
      (p.tags || []).some(t => t.includes(ql)) ||
      (p.category_id || '').includes(ql)
    );
  }, [q, posts]);

  return (
    <div className="search-app">
      <input
        autoFocus
        className="search-input-big"
        placeholder="grep posts/ -r --color=auto …"
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      <div className="search-results">
        {q && results.length === 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faint)', padding: 12 }}>
            // sin resultados para "{q}"
          </div>
        )}
        {results.map(p => (
          <div key={p.id} className="search-result" onClick={() => openPost && openPost(p.id)}>
            <div className="title">{p.title}</div>
            <div className="preview">{p.excerpt}</div>
            <div className="meta">{p.date} · {p.category_label || p.category_id} · {(p.tags||[]).map(t=>'#'+t).join(' ')}</div>
          </div>
        ))}
        {!q && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', padding: 12, lineHeight: 1.8 }}>
            <div>// busca por título, tag, categoría o excerpt</div>
            <div>// prueba: <span style={{ color: 'var(--neon)' }}>linux</span>, <span style={{ color: 'var(--neon)' }}>vim</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar App ───────────────────────────────────────────────
// Los días con post se pueden pulsar; debajo se listan los posts del mes
// (o del día elegido) y cada uno abre su ventana.
function CalendarApp({ openPost }) {
  const posts = window.BLOG_POSTS || [];
  const today = new Date();
  const [view, setView] = useS({ y: today.getFullYear(), m: today.getMonth() });
  const [day, setDay] = useS(null);

  const monthName = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][view.m];
  const first  = new Date(view.y, view.m, 1);
  const offset = (first.getDay() + 6) % 7; // Lun=0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prefix = `${view.y}-${String(view.m + 1).padStart(2,'0')}`;
  const monthPosts = useMemo(() => posts.filter(p => (p.date || '').startsWith(prefix)).sort((a, b) => (a.date < b.date ? -1 : 1)), [posts, prefix]);
  const postDays = useMemo(() => new Set(monthPosts.map(p => parseInt(p.date.slice(8, 10), 10))), [monthPosts]);
  const listed = day ? monthPosts.filter(p => parseInt(p.date.slice(8, 10), 10) === day) : monthPosts;

  const move = (fn) => { setView(fn); setDay(null); };
  const prev = () => move(v => v.m === 0  ? { y: v.y-1, m: 11 } : { y: v.y, m: v.m-1 });
  const next = () => move(v => v.m === 11 ? { y: v.y+1, m: 0  } : { y: v.y, m: v.m+1 });
  const navBtn = { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 4, height: 28, cursor: 'pointer' };

  return (
    <div className="cal">
      <div className="cal-header">
        <h3>{monthName} {view.y}</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={prev} style={{ ...navBtn, width: 28 }} aria-label="Mes anterior">‹</button>
          <button onClick={() => move(() => ({ y: today.getFullYear(), m: today.getMonth() }))} style={{ ...navBtn, padding: '0 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>hoy</button>
          <button onClick={next} style={{ ...navBtn, width: 28 }} aria-label="Mes siguiente">›</button>
        </div>
      </div>
      <div className="cal-grid">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="cal-cell empty"></div>;
          const isToday = view.y === today.getFullYear() && view.m === today.getMonth() && d === today.getDate();
          const hasPost = postDays.has(d);
          const cls = `cal-cell${isToday ? ' today' : ''}${hasPost ? ' has-post' : ''}${day === d ? ' selected' : ''}`;
          return hasPost
            ? <button key={i} className={cls} onClick={() => setDay(x => (x === d ? null : d))} aria-pressed={day === d} title="Ver posts de este día">{d}</button>
            : <div key={i} className={cls}>{d}</div>;
        })}
      </div>
      <div style={{ marginTop: 18, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', display: 'flex', gap: 16 }}>
        <span><span style={{ color: 'var(--neon)' }}>■</span> hoy</span>
        <span><span style={{ color: 'var(--accent-pink)' }}>●</span> post publicado (pulsa el día)</span>
      </div>
      <div className="cal-posts">
        <div className="cal-posts-head">
          {day ? `${day} de ${monthName.toLowerCase()}` : `Posts de ${monthName.toLowerCase()}`} · {listed.length}
          {day && <button onClick={() => setDay(null)}>ver todo el mes</button>}
        </div>
        {listed.length === 0 && <div className="cal-posts-empty">// sin posts este mes</div>}
        {listed.map(p => (
          <div key={p.id} className="search-result" onClick={() => openPost && openPost(p.id)}>
            <div className="title">{p.title}</div>
            <div className="meta">{p.date} · {p.category_label || p.category_id}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Gallery App ────────────────────────────────────────────────
// Cada imagen abre su propia ventana (id "image-<id>").
function GalleryApp({ onOpenImage }) {
  const [files, setFiles] = useS(null);

  useEffect(() => {
    fetch('api/media')
      .then(r => r.json())
      .then(res => setFiles(res.ok ? res.data : []))
      .catch(() => setFiles([]));
  }, []);

  if (files === null) return <div className="gallery"><div className="gallery-empty">cargando…</div></div>;
  if (files.length === 0) {
    return (
      <div className="gallery">
        <div className="gallery-empty">
          <div style={{ fontSize: 32, marginBottom: 8 }}>🖼</div>
          ~/imágenes está vacío
        </div>
      </div>
    );
  }

  return (
    <div className="gallery">
      <div className="gallery-grid">
        {files.map(f => (
          <button key={f.id} className="gallery-item" onClick={() => onOpenImage && onOpenImage(f)} title={f.original_name}>
            <img src={f.url} alt={f.original_name} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Image viewer (ventana por imagen) ──────────────────────────
function ImageViewerApp({ file }) {
  return (
    <div className="img-viewer">
      <div className="img-viewer-stage"><img src={file.url} alt={file.original_name} /></div>
      <div className="img-viewer-bar">
        <span>{file.original_name}</span>
        {file.width && file.height && <span>{file.width}×{file.height}</span>}
        <a href={file.url} target="_blank" rel="noopener">abrir original ↗</a>
      </div>
    </div>
  );
}

// ── Settings App ───────────────────────────────────────────────
// Lee y escribe los ajustes por contexto: se actualiza al momento aunque la
// ventana se haya abierto antes del cambio.
function SettingsApp() {
  const { tweaks, setTweak } = window.useTweakContext();
  const Toggle = ({ k, label, hint, def = true }) => {
    const on = tweaks[k] === undefined ? def : !!tweaks[k];
    return (
      <label className="st-toggle">
        <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
        <input type="checkbox" role="switch" checked={on} onChange={() => setTweak(k, !on)} />
        <span className="st-switch" aria-hidden="true" />
      </label>
    );
  };
  return (
    <div className="settings-app">
      <section>
        <h3>// fondo de pantalla</h3>
        <div className="st-walls" role="radiogroup" aria-label="Fondo de pantalla">
          {window.WALLPAPERS.map(w => (
            <button key={w.id} role="radio" aria-checked={(tweaks.wallpaper || 'neon') === w.id}
              className={`st-wall${(tweaks.wallpaper || 'neon') === w.id ? ' active' : ''}`}
              onClick={() => setTweak('wallpaper', w.id)}>
              <span className={`st-wall-preview wp-${w.id}`} style={w.style} />
              <span>{w.label}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>// color de acento</h3>
        <div className="st-accents" role="radiogroup" aria-label="Color de acento">
          {window.ACCENTS.map(a => (
            <button key={a.id} role="radio" aria-checked={(tweaks.accent || 'neon-green') === a.id}
              className={`st-accent${(tweaks.accent || 'neon-green') === a.id ? ' active' : ''}`}
              style={{ '--sw': a.colors[0], '--sw2': a.colors[1] }}
              onClick={() => setTweak('accent', a.id)} title={a.label}>
              <span className="st-accent-dot" />
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>// sistema</h3>
        <Toggle k="soundsOn" label="Sonidos" hint="clic al abrir ventanas" />
        <Toggle k="showBoot" label="Animación de arranque" hint="log del kernel al entrar" />
      </section>
    </div>
  );
}

// ── Mail App ───────────────────────────────────────────────────
function MailApp() {
  const [form, setForm] = useS({ sender_name: '', sender_email: '', subject: '', body: '' });
  const [status, setStatus] = useS('idle');
  const tsRef = useRef(Date.now());

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, _hp: '', _ts: Math.floor(tsRef.current / 1000) }),
      }).then(r => r.json());
      setStatus(res.ok ? 'sent' : (res.error || 'error'));
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="mail">
        <div className="mail-success">
          <div className="icon">✉️</div>
          <h2>Mensaje enviado</h2>
          <p>Gracias por escribir. Responderé en cuanto pueda.</p>
          <button style={{ marginTop: 16 }} onClick={() => { setStatus('idle'); setForm({ sender_name:'', sender_email:'', subject:'', body:'' }); tsRef.current = Date.now(); }}>
            Nuevo mensaje
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mail">
      <h2>Contacto</h2>
      <div className="sub">¿Alguna pregunta, propuesta o simplemente quieres saludar?</div>
      <form className="mail-form" onSubmit={submit}>
        <div className="row">
          <div>
            <label htmlFor="mail-name">Nombre</label>
            <input id="mail-name" value={form.sender_name} onChange={e => set('sender_name', e.target.value)} required placeholder="Tu nombre" autoComplete="name" maxLength={120} />
          </div>
          <div>
            <label htmlFor="mail-email">Email</label>
            <input id="mail-email" value={form.sender_email} onChange={e => set('sender_email', e.target.value)} required type="email" placeholder="tu@email.com" autoComplete="email" maxLength={200} />
          </div>
        </div>
        <label htmlFor="mail-subject">Asunto</label>
        <input id="mail-subject" maxLength={300} value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Asunto (opcional)" />
        <label htmlFor="mail-body">Mensaje</label>
        <textarea id="mail-body" maxLength={5000} value={form.body} onChange={e => set('body', e.target.value)} required placeholder="Escribe tu mensaje…" rows={5} />
        <div className="hint">Tu email no se publicará. Respondo personalmente.</div>
        {typeof status === 'string' && status !== 'idle' && status !== 'sending' && status !== 'sent' && (
          <div className="err">{status}</div>
        )}
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Enviando…' : '$ enviar mensaje'}
        </button>
      </form>
    </div>
  );
}

// ── Terminal App ───────────────────────────────────────────────
function TerminalApp({ autoFocus = true, openPost }) {
  const posts = window.BLOG_POSTS || [];
  const [lines, setLines] = useS([
    { type: 'output', text: 'jr-os terminal v1.0 — escribe `help` para ver comandos' },
  ]);
  const [input, setInput] = useS('');
  const [hist,  setHist]  = useS([]);
  const [hIdx,  setHIdx]  = useS(-1);
  const [caret, setCaret] = useS(0);        // posición del cursor de bloque
  const [focused, setFocused] = useS(false);
  const endRef   = useRef(null);
  const inputRef = useRef(null);
  const moveToEnd = useRef(false);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [lines]);

  // Tras recuperar un comando del historial, el cursor va al final
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (moveToEnd.current) { moveToEnd.current = false; el.setSelectionRange(input.length, input.length); }
    setCaret(el.selectionStart ?? input.length);
  }, [input]);

  const syncCaret = () => { const el = inputRef.current; if (el) setCaret(el.selectionStart ?? 0); };

  // Clic en cualquier parte de la terminal → escribir en la línea de comandos.
  // Si el usuario está seleccionando texto (para copiarlo), no se le quita.
  const focusInput = (e) => {
    if (e.target === inputRef.current) return;
    if (String(window.getSelection?.() || '')) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
    syncCaret();
    endRef.current?.scrollIntoView({ block: 'nearest' });
  };

  const run = (cmd) => {
    const c = cmd.trim().toLowerCase();
    const add = (text, type='output') => setLines(l => [...l, { type, text }]);

    add(`$ ${cmd}`, 'prompt');

    if (!c || c === '') return;
    if (c === 'help') {
      add('Comandos disponibles:');
      add('  ls          — listar posts');
      add('  cat <id>    — leer un post');
      if (openPost) add('  open <id>   — abrir un post');
      add('  whoami      — sobre el autor');
      add('  clear       — limpiar terminal');
      add('  uname -a    — info del sistema');
    } else if (c === 'ls' || c === 'ls -la') {
      add('total ' + posts.length);
      posts.forEach(p => add(`-rw-r--r-- 1 jr jr  ${p.date}  ${p.id}`));
    } else if (c.startsWith('cat ')) {
      const id = c.slice(4).trim();
      const p = posts.find(p => p.id === id);
      if (p) { add(p.title); add(''); add(p.excerpt || '(sin extracto)'); if (openPost) add(`→ open ${p.id} para leerlo entero`); }
      else add(`cat: ${id}: No such file or directory`);
    } else if (openPost && (c === 'open' || c.startsWith('open '))) {
      const id = c.slice(5).trim();
      const p = posts.find(p => p.id === id);
      if (!id) add('uso: open <id>   (ls para ver los ids)');
      else if (p) { add(`abriendo ${p.id}…`); openPost(p.id); }
      else add(`open: ${id}: No such file or directory`);
    } else if (c === 'whoami') {
      const a = window.BLOG_ABOUT || {};
      add(`jr · ${a.name || 'jr'}`);
      if (a.role) add(a.role);
      if (a.subtitle) add(a.subtitle);
    } else if (c === 'uname -a') {
      add('Linux jr-os 6.8.0 #1 SMP x86_64 GNU/Linux — jr-os WM 1.0');
    } else if (c === 'clear') {
      setLines([]);
      return;
    } else if (c === 'exit') {
      add('logout');
    } else {
      add(`bash: ${c}: command not found`);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter') {
      run(input);
      if (input.trim()) setHist(h => [input, ...h].slice(0, 50));
      setHIdx(-1);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hist.length) return;
      const idx = Math.min(hIdx + 1, hist.length - 1);
      setHIdx(idx);
      moveToEnd.current = true;
      setInput(hist[idx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(hIdx - 1, -1);
      setHIdx(idx);
      moveToEnd.current = true;
      setInput(idx === -1 ? '' : (hist[idx] || ''));
    } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      // Ctrl+L limpia la pantalla, como en bash
      e.preventDefault();
      setLines([]);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'c' && !String(window.getSelection?.() || '')) {
      // Ctrl+C sin texto seleccionado cancela la línea (con selección, copia)
      e.preventDefault();
      setLines(l => [...l, { type: 'prompt', text: '$ ' + input + '^C' }]);
      setInput('');
      setHIdx(-1);
    }
  };

  const before = input.slice(0, caret);
  const under  = input.slice(caret, caret + 1) || ' ';
  const after  = input.slice(caret + 1);

  return (
    <div className="term" onClick={focusInput}>
      {lines.map((l, i) => (
        <div key={i}>
          {l.type === 'prompt'
            ? <><span className="prompt">jr@jr-os</span><span style={{color:'#555'}}> ~ </span><span style={{color:'var(--neon)'}}>{l.text.slice(2)}</span></>
            : <span className="out">{l.text}</span>
          }
        </div>
      ))}
      <div className="term-input-line">
        <span className="prompt">jr@jr-os</span>
        <span style={{ color: '#555' }}> ~ </span>
        <div className="term-field">
          {/* Lo que se ve: el texto con un cursor de bloque. El <input> real
              va encima, transparente, y es el que recibe teclado y clics. */}
          <span className="term-mirror" aria-hidden="true">
            {before}<span key={input + caret} className={`term-cursor${focused ? '' : ' idle'}`}>{under}</span>{after}
          </span>
          <input
            ref={inputRef}
            className="term-input"
            value={input}
            onChange={e => { setInput(e.target.value); setCaret(e.target.selectionStart ?? 0); }}
            onKeyDown={onKey}
            onKeyUp={syncCaret}
            onSelect={syncCaret}
            onFocus={() => { setFocused(true); syncCaret(); }}
            onBlur={() => setFocused(false)}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            enterKeyHint="send"
            aria-label="Comando de terminal"
          />
        </div>
      </div>
      <div ref={endRef} />
    </div>
  );
}

// ── About App ──────────────────────────────────────────────────
function AboutApp() {
  const a = window.BLOG_ABOUT || {};
  const stack = a.stack || [];
  const links = a.links || [];
  return (
    <div className="about">
      <div className="about-hero">
        <div className="about-avatar">
          {a.avatar ? <img src={a.avatar} alt={a.name || ''} /> : window.aboutInitials()}
        </div>
        <div>
          <h2 className="name">{a.name}</h2>
          {a.role && <div className="role">{a.role}</div>}
          {a.subtitle && <div className="domain">{a.subtitle}</div>}
        </div>
      </div>
      {a.bio && (
        <div className="about-section">
          <h3>// whoami</h3>
          <div className="about-bio" dangerouslySetInnerHTML={{ __html: md(a.bio) }} />
        </div>
      )}
      {stack.length > 0 && (
        <div className="about-section">
          <h3>// stack</h3>
          <div className="skill-grid">
            {stack.map(s => <div key={s} className="skill"><span className="kbd">$</span> {s}</div>)}
          </div>
        </div>
      )}
      {links.length > 0 && (
        <div className="about-section">
          <h3>// contacto</h3>
          {links.map((l, i) => (
            <div key={i} className="contact-row">
              <span className="key">{l.label}</span>
              {l.url
                ? <a href={l.url} {...(/^https?:/i.test(l.url) ? { target: '_blank', rel: 'me noopener noreferrer' } : {})}>{l.text}</a>
                : <span>{l.text}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

window.usePost     = usePost;
window.trackView   = trackView;
window.ReaderApp   = ReaderApp;
window.CommentsApp = CommentsApp;
window.FilesApp    = FilesApp;
window.PostApp     = PostApp;
window.NotesApp    = NotesApp;
window.TagsApp     = TagsApp;
window.SearchApp   = SearchApp;
window.CalendarApp = CalendarApp;
window.GalleryApp  = GalleryApp;
window.MailApp     = MailApp;
window.ImageViewerApp = ImageViewerApp;
window.SettingsApp = SettingsApp;
window.TerminalApp = TerminalApp;
window.AboutApp    = AboutApp;
})();
