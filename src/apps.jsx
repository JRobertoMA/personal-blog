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
              ─── Gracias por leer. — JR
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
function CommentsApp({ postId }) {
  const [comments, setComments] = useS([]);
  const [name,  setName]  = useS(() => localStorage.getItem('jr-comment-name')  || '');
  const [email, setEmail] = useS(() => localStorage.getItem('jr-comment-email') || '');
  const [body,  setBody]  = useS('');
  const [status, setStatus] = useS('idle');
  const tsRef = useRef(Date.now());

  const pid = postId || ((window.BLOG_POSTS || [])[0]?.id);

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

  return (
    <div className="app-scroll">
      <div className="comments-section">
        <h3>Comentarios</h3>
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
          <div style={{ padding: '12px', background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 6, fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
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
function FilesApp({ onOpenPost }) {
  const posts = window.BLOG_POSTS || [];
  const cats  = window.BLOG_CATEGORIES || [];
  const [cat, setCat] = useS('all');

  const filtered = cat === 'all' ? posts : posts.filter(p => p.category_id === cat);

  return (
    <div className="fx">
      <div className="fx-toolbar">
        <button>←</button>
        <button>→</button>
        <button>↑</button>
        <div className="fx-path">/home/jr/posts/{cat === 'all' ? '' : cat + '/'}</div>
        <button>⌕</button>
        <button>≡</button>
      </div>
      <div className="fx-main">
        <div className="fx-sidebar">
          <div className="group">Lugares</div>
          <div className={`item${cat === 'all' ? ' active' : ''}`} onClick={() => setCat('all')}><span>📁</span>todos</div>
          <div className="item"><span>⭐</span>destacados</div>
          <div className="item"><span>🕒</span>recientes</div>
          <div className="group">Categorías</div>
          {cats.map(c => (
            <div key={c.id} className={`item${cat === c.id ? ' active' : ''}`} onClick={() => setCat(c.id)}>
              <span style={{ color: c.color }}>●</span>{c.label.toLowerCase()}
            </div>
          ))}
          <div className="group">Discos</div>
          <div className="item"><span>💾</span>jr-blog 2.4G</div>
        </div>
        <div className="fx-list">
          <div className="fx-row header">
            <span></span>
            <span>Nombre</span>
            <span>Categoría</span>
            <span>Fecha</span>
            <span>Tags</span>
          </div>
          {filtered.map(p => (
            <div key={p.id} className="fx-row"
              onClick={() => onOpenPost && onOpenPost(p.id)}
              onDoubleClick={() => onOpenPost && onOpenPost(p.id)}
            >
              <span>📄</span>
              <span className="name">{p.title}.md</span>
              <span>{p.category_label || p.category_id}</span>
              <span>{p.date}</span>
              <span>{(p.tags || []).length}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="fx-statusbar">
        {filtered.length} archivo(s) · {cats.length} categorías · libre: 1.2 TB
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
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>─── Gracias por leer. — JR</p>
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
  const today = new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });
  return (
    <div className="notes">
      <div className="star">★ NOTAS PERSONALES — {today}</div>
      <div>&nbsp;</div>
      <div>· terminar post sobre tmux antes del viernes</div>
      <div>· investigar por qué el ventilador hace ruido a 3000 rpm</div>
      <div className="scribble">· (probable: cable EPS rozando el aspa)</div>
      <div>&nbsp;</div>
      <div className="star">★ ideas que pueden ser posts</div>
      <div>· ¿es razonable correr Postgres en una raspberry pi 5?</div>
      <div>· historia de los terminales: de VT100 al emulador moderno</div>
      <div>· nftables vs iptables: cuándo migrar</div>
      <div>&nbsp;</div>
      <div className="star">★ pendientes</div>
      <div>· actualizar la pi a bookworm</div>
      <div>· montar raid1 en el NAS</div>
      <div className="scribble">· (comprar dos discos de 4TB antes de que suban de precio)</div>
    </div>
  );
}

// ── Tags App ───────────────────────────────────────────────────
function TagsApp({ openPost }) {
  const posts = window.BLOG_POSTS || [];
  const cats  = window.BLOG_CATEGORIES || [];

  const allTags = useMemo(() => {
    const map = {};
    posts.forEach(p => (p.tags || []).forEach(t => { map[t] = (map[t] || 0) + 1; }));
    return Object.entries(map).sort((a,b) => b[1]-a[1]);
  }, [posts]);

  const sizes = [11, 13, 15, 18, 22];
  const max = Math.max(...allTags.map(t => t[1]), 1);

  return (
    <div className="tags-app">
      <h2>Tags & Categorías</h2>
      <div className="sub">// {allTags.length} tags totales · {cats.length} categorías</div>
      <div className="tags-cloud">
        {allTags.map(([tag, count]) => (
          <span key={tag} className="tag-chip"
            style={{ fontSize: sizes[Math.min(sizes.length-1, Math.floor((count/max)*sizes.length))] }}
            onClick={() => openPost && openPost(posts.find(p=>(p.tags||[]).includes(tag))?.id)}
          >
            #{tag} <span className="count">{count}</span>
          </span>
        ))}
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--text)', margin: '0 0 12px' }}>Categorías</h2>
      {cats.map(c => {
        const n = posts.filter(p => p.category_id === c.id).length;
        return (
          <div key={c.id} className="cat-card" style={{ borderLeftColor: c.color || 'var(--neon)' }}>
            <div className="name">{c.label} <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>· {n} post{n !== 1 ? 's' : ''}</span></div>
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
function CalendarApp() {
  const posts = window.BLOG_POSTS || [];
  const today = new Date();
  const [view, setView] = useS({ y: today.getFullYear(), m: today.getMonth() });

  const monthName = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][view.m];
  const first  = new Date(view.y, view.m, 1);
  const offset = (first.getDay() + 6) % 7; // Lun=0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const postDays = useMemo(() => new Set(
    posts
      .filter(p => p.date.startsWith(`${view.y}-${String(view.m + 1).padStart(2,'0')}`))
      .map(p => parseInt(p.date.slice(8, 10), 10))
  ), [posts, view.y, view.m]);

  const prev = () => setView(v => v.m === 0  ? { y: v.y-1, m: 11 } : { y: v.y, m: v.m-1 });
  const next = () => setView(v => v.m === 11 ? { y: v.y+1, m: 0  } : { y: v.y, m: v.m+1 });

  return (
    <div className="cal">
      <div className="cal-header">
        <h3>{monthName} {view.y}</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={prev} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 4, width: 28, height: 28, cursor: 'pointer' }}>‹</button>
          <button onClick={() => setView({ y: today.getFullYear(), m: today.getMonth() })} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 4, padding: '0 10px', height: 28, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11 }}>hoy</button>
          <button onClick={next} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 4, width: 28, height: 28, cursor: 'pointer' }}>›</button>
        </div>
      </div>
      <div className="cal-grid">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="cal-cell empty"></div>;
          const isToday = view.y === today.getFullYear() && view.m === today.getMonth() && d === today.getDate();
          const hasPost = postDays.has(d);
          return <div key={i} className={`cal-cell${isToday ? ' today' : ''}${hasPost ? ' has-post' : ''}`}>{d}</div>;
        })}
      </div>
      <div style={{ marginTop: 18, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', display: 'flex', gap: 16 }}>
        <span><span style={{ color: 'var(--neon)' }}>■</span> hoy</span>
        <span><span style={{ color: 'var(--accent-pink)' }}>●</span> post publicado</span>
      </div>
    </div>
  );
}

// ── Gallery App ────────────────────────────────────────────────
function GalleryApp() {
  const [files, setFiles] = useS([]);

  useEffect(() => {
    fetch('api/media')
      .then(r => r.json())
      .then(res => { if (res.ok) setFiles(res.data); })
      .catch(() => {});
  }, []);

  const placeholders = [
    { emoji: '🖼️', label: 'screenshot.png' },
    { emoji: '📸', label: 'foto.jpg' },
    { emoji: '🎨', label: 'design.svg' },
    { emoji: '💻', label: 'terminal.png' },
    { emoji: '⚡', label: 'bench.png' },
    { emoji: '🌐', label: 'network.png' },
    { emoji: '🔧', label: 'config.png' },
    { emoji: '📡', label: 'signal.png' },
    { emoji: '🗂️', label: 'files.png' },
  ];

  return (
    <div className="gallery">
      <div className="gallery-grid">
        {files.length > 0
          ? files.map(f => (
              <div key={f.id} className="gallery-item">
                <img src={f.url} alt={f.original_name} />
              </div>
            ))
          : placeholders.map((p, i) => (
              <div key={i} className="gallery-item">
                <div className="label">{p.emoji}<br/>{p.label}</div>
              </div>
            ))
        }
      </div>
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
function TerminalApp({ autoFocus = true }) {
  const posts = window.BLOG_POSTS || [];
  const [lines, setLines] = useS([
    { type: 'output', text: 'jr-os terminal v1.0 — escribe `help` para ver comandos' },
  ]);
  const [input, setInput] = useS('');
  const [hist,  setHist]  = useS([]);
  const [hIdx,  setHIdx]  = useS(-1);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  const run = (cmd) => {
    const c = cmd.trim().toLowerCase();
    const add = (text, type='output') => setLines(l => [...l, { type, text }]);

    add(`$ ${cmd}`, 'prompt');

    if (!c || c === '') return;
    if (c === 'help') {
      add('Comandos disponibles:');
      add('  ls          — listar posts');
      add('  cat <id>    — leer un post');
      add('  whoami      — sobre el autor');
      add('  clear       — limpiar terminal');
      add('  uname -a    — info del sistema');
    } else if (c === 'ls' || c === 'ls -la') {
      add('total ' + posts.length);
      posts.forEach(p => add(`-rw-r--r-- 1 jr jr  ${p.date}  ${p.id}`));
    } else if (c.startsWith('cat ')) {
      const id = c.slice(4).trim();
      const p = posts.find(p => p.id === id);
      if (p) { add(p.title); add(''); add(p.excerpt || '(sin extracto)'); }
      else add(`cat: ${id}: No such file or directory`);
    } else if (c === 'whoami') {
      add('jr · J. Roberto M.');
      add('Sysadmin, programador, entusiasta del hardware retro.');
      add('jrobertoma.com');
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
      setHist(h => [input, ...h].slice(0, 50));
      setHIdx(-1);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(hIdx + 1, hist.length - 1);
      setHIdx(idx);
      setInput(hist[idx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(hIdx - 1, -1);
      setHIdx(idx);
      setInput(idx === -1 ? '' : (hist[idx] || ''));
    }
  };

  return (
    <div className="term">
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
        <input
          className="term-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="send"
          aria-label="Comando de terminal"
        />
      </div>
      <div ref={endRef} />
    </div>
  );
}

// ── About App ──────────────────────────────────────────────────
function AboutApp() {
  return (
    <div className="about">
      <div className="about-hero">
        <div className="about-avatar">JR</div>
        <div>
          <h2 className="name">J. Roberto M.</h2>
          <div className="role">Software dev · Tinkerer · Curioso profesional</div>
          <div className="domain">jrobertoma.com</div>
        </div>
      </div>
      <div className="about-section">
        <h3>// whoami</h3>
        <p>Programador, entusiasta del hardware y del open source. Escribo sobre lo que aprendo —software, sistemas, videojuegos y de vez en cuando lo que no entra en ninguna de esas categorías.</p>
        <p>Este sitio es mi escritorio. Las ventanas se mueven, la terminal funciona, y los posts viven dentro de un explorador. Si te gusta cacharrear con sistemas, probablemente te sientas en casa.</p>
      </div>
      <div className="about-section">
        <h3>// stack</h3>
        <div className="skill-grid">
          <div className="skill"><span className="kbd">$</span> rust</div>
          <div className="skill"><span className="kbd">$</span> typescript</div>
          <div className="skill"><span className="kbd">$</span> python</div>
          <div className="skill"><span className="kbd">$</span> linux</div>
          <div className="skill"><span className="kbd">$</span> docker</div>
          <div className="skill"><span className="kbd">$</span> postgres</div>
          <div className="skill"><span className="kbd">$</span> vim</div>
          <div className="skill"><span className="kbd">$</span> tmux</div>
        </div>
      </div>
      <div className="about-section">
        <h3>// contacto</h3>
        <div className="contact-row"><span className="key">email</span><a href="mailto:hola@jrobertoma.com">hola@jrobertoma.com</a></div>
        <div className="contact-row"><span className="key">github</span><a href="https://github.com/jrobertoma" target="_blank" rel="noopener noreferrer">@jrobertoma</a></div>
        <div className="contact-row"><span className="key">mastodon</span><a href="https://hachyderm.io/@jrobertoma" target="_blank" rel="me noopener noreferrer">@jrobertoma@hachyderm.io</a></div>
        <div className="contact-row"><span className="key">rss</span><span>jrobertoma.com/feed.xml</span></div>
      </div>
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
window.TerminalApp = TerminalApp;
window.AboutApp    = AboutApp;
})();
