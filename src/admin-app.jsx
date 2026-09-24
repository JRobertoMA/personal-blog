const { useState, useEffect, useMemo, useRef, useCallback } = React;

let _csrfToken = '';

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (_csrfToken && opts.method && opts.method !== 'GET') {
    headers['X-CSRF-Token'] = _csrfToken;
  }
  const res = await fetch('api' + path, { ...opts, headers });
  return res.json();
}

// ── Simple markdown renderer ───────────────────────────────────
const renderMd = (text) => window.renderMarkdown(text);

// ── Login ──────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: user, password: pass }) });
      if (res.ok) { _csrfToken = res.data.csrf_token; onLogin(res.data.username); }
      else setError(res.error || 'Credenciales incorrectas');
    } catch { setError('Error de red. Intenta de nuevo.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="logo">jr<span>·</span>admin</div>
        <div className="subtitle">Panel de administración · jrobertoma.com</div>
        <form onSubmit={submit}>
          <div className="field"><label>Usuario</label><input autoFocus value={user} onChange={e=>setUser(e.target.value)} placeholder="admin" required /></div>
          <div className="field"><label>Contraseña</label><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required /></div>
          <button type="submit" className="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
          {error && <div className="error">{error}</div>}
        </form>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────
function Dashboard({ onNewPost }) {
  const [data, setData] = useState(null);
  useEffect(() => { api('/analytics?days=30').then(r => { if (r.ok) setData(r.data); }); }, []);
  const bars = useMemo(() => data?.daily || Array.from({length:30},()=>({views:Math.round(30+Math.random()*70)})), [data]);
  const maxViews = Math.max(1, ...bars.map(b => b.views));

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Dashboard</h1><div className="page-sub">Últimos 30 días</div></div>
        <div className="page-actions">
          <button className="btn" onClick={() => window.open('/','_blank')}>Ver sitio</button>
          <button className="btn primary" onClick={onNewPost}>+ Nuevo post</button>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat"><div className="label">Visitas (30d)</div><div className="value">{data ? Number(data.totals?.total_views||0).toLocaleString() : '—'}</div></div>
        <div className="stat"><div className="label">Posts</div><div className="value">{data?.totals?.posts ?? '—'}</div></div>
        <div className="stat"><div className="label">Comentarios</div><div className="value">{data?.totals?.comments ?? '—'}</div></div>
        <div className="stat"><div className="label">Mensajes</div><div className="value">{data?.totals?.messages ?? '—'}</div></div>
      </div>
      <div className="two-col">
        <div className="card">
          <h3 style={{margin:'0 0 6px',fontSize:14,fontWeight:600}}>Visitas por día</h3>
          <div className="chart">{bars.map((b,i) => <div key={i} className="bar" style={{height:`${(b.views/maxViews)*100}%`}} title={`${b.date||i}: ${b.views}`}></div>)}</div>
        </div>
        <div className="card" style={{padding:0}}>
          <h3 style={{margin:0,fontSize:14,fontWeight:600,padding:'20px 20px 12px'}}>Posts más vistos</h3>
          {(data?.top_posts||[]).slice(0,5).map(p => (
            <div key={p.id} className="card-row" style={{padding:'10px 20px'}}>
              <div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.title}</div><div style={{fontSize:11.5,color:'var(--text-faint)',fontFamily:'var(--font-mono)'}}>{p.date}</div></div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-dim)',flexShrink:0,marginLeft:10}}>{Number(p.views).toLocaleString()}</div>
            </div>
          ))}
          {(!data?.top_posts || data.top_posts.length === 0) && <div style={{padding:'20px',color:'var(--text-faint)',fontSize:13}}>Sin datos todavía</div>}
        </div>
      </div>
    </>
  );
}

// ── Posts List ─────────────────────────────────────────────────
function PostsList({ onEdit, onNew }) {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    Promise.all([
      api('/posts?status=all').then(r => { if (r.ok) setPosts(r.data.posts||[]); }),
    ]);
  }, []);

  const filtered = posts.filter(p =>
    (filter === 'all' || p.status === filter) &&
    (!q || p.title.toLowerCase().includes(q.toLowerCase()))
  );

  const del = async (id) => {
    if (!confirm('¿Eliminar este post?')) return;
    const r = await api(`/posts/${id}`, { method: 'DELETE' });
    if (r.ok) setPosts(ps => ps.filter(p => p.id !== id));
  };

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Posts</h1><div className="page-sub">{posts.length} posts en total</div></div>
        <div className="page-actions"><button className="btn primary" onClick={onNew}>+ Nuevo post</button></div>
      </div>
      <div className="card" style={{padding:0}}>
        <div className="toolbar">
          <input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)} style={{flex:1,maxWidth:280}} />
          <select value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
            <option value="scheduled">Programados</option>
          </select>
          <span style={{marginLeft:'auto',fontSize:12,color:'var(--text-faint)'}}>{filtered.length} resultados</span>
        </div>
        <table className="table">
          <thead><tr><th>Título</th><th>Categoría</th><th>Estado</th><th>Fecha</th><th>Visitas</th><th>Acciones</th></tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td style={{fontWeight:500,maxWidth:280}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.title}</div></td>
                <td style={{fontSize:12,color:'var(--text-dim)'}}>{p.category_label||p.category_id}</td>
                <td><span className={`pill ${p.status}`}>{p.status}</span></td>
                <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{p.date}</td>
                <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{Number(p.views||0).toLocaleString()}</td>
                <td>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn sm" onClick={() => onEdit(p)}>Editar</button>
                    <button className="btn sm danger" onClick={() => del(p.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} style={{textAlign:'center',color:'var(--text-faint)',padding:24}}>Sin posts</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Editor ─────────────────────────────────────────────────────
function Editor({ initial, onSaved, onBack }) {
  const [cats, setCats] = useState([]);
  const [tab, setTab] = useState('edit');
  const [form, setForm] = useState({
    id: initial?.id || '',
    title: initial?.title || '',
    body: initial?.body || '',
    excerpt: initial?.excerpt || '',
    category_id: initial?.category_id || '',
    status: initial?.status || 'draft',
    date: initial?.date || new Date().toISOString().slice(0,10),
    tags: (initial?.tags||[]).join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api('/categories').then(r => { if (r.ok) setCats(r.data); }); }, []);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const save = async () => {
    setSaving(true); setError('');
    const payload = { ...form, tags: form.tags.split(',').map(t=>t.trim()).filter(Boolean) };
    const r = initial?.id
      ? await api(`/posts/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await api('/posts', { method: 'POST', body: JSON.stringify(payload) });
    setSaving(false);
    if (r.ok) onSaved();
    else setError(r.error || 'Error al guardar');
  };

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">{initial ? 'Editar post' : 'Nuevo post'}</h1></div>
        <div className="page-actions">
          <button className="btn" onClick={onBack}>← Volver</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
      {error && <div style={{color:'var(--danger)',fontSize:12,marginBottom:12}}>{error}</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:20}}>
        <div>
          <div className="form-group">
            <label className="form-label">Título</label>
            <input className="form-input" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Título del post" />
          </div>
          <div className="tabs">
            <div className={`tab${tab==='edit'?' active':''}`} onClick={()=>setTab('edit')}>Editar</div>
            <div className={`tab${tab==='preview'?' active':''}`} onClick={()=>setTab('preview')}>Preview</div>
          </div>
          {tab === 'edit'
            ? <textarea className="form-input form-textarea" style={{height:340}} value={form.body} onChange={e=>set('body',e.target.value)} placeholder="Contenido en Markdown…" />
            : <div className="md-preview" dangerouslySetInnerHTML={{__html: renderMd(form.body)}} />
          }
        </div>
        <div>
          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select className="form-input form-select" value={form.category_id} onChange={e=>set('category_id',e.target.value)}>
              <option value="">Seleccionar…</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-input form-select" value={form.status} onChange={e=>set('status',e.target.value)}>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="scheduled">Programado</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input className="form-input" type="date" value={form.date} onChange={e=>set('date',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Slug / ID</label>
            <input className="form-input" value={form.id} onChange={e=>set('id',e.target.value)} placeholder="mi-post-url" />
            <div className="form-hint">Dejar vacío para auto-generar</div>
          </div>
          <div className="form-group">
            <label className="form-label">Tags</label>
            <input className="form-input" value={form.tags} onChange={e=>set('tags',e.target.value)} placeholder="linux, kernel, rust" />
            <div className="form-hint">Separados por comas</div>
          </div>
          <div className="form-group">
            <label className="form-label">Extracto</label>
            <textarea className="form-input" style={{minHeight:80,resize:'vertical'}} value={form.excerpt} onChange={e=>set('excerpt',e.target.value)} placeholder="Breve descripción del post…" />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Categories & Tags ──────────────────────────────────────────
function TagsManager() {
  const [cats, setCats] = useState([]);
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [newCat, setNewCat] = useState({ id:'', label:'', color:'#39ff14' });

  useEffect(() => {
    api('/categories').then(r => { if (r.ok) setCats(r.data); });
    api('/tags').then(r => { if (r.ok) setTags(r.data); });
  }, []);

  const addTag = async () => {
    if (!newTag.trim()) return;
    const r = await api('/tags', { method: 'POST', body: JSON.stringify({ name: newTag.trim() }) });
    if (r.ok) { api('/tags').then(r2 => { if (r2.ok) setTags(r2.data); }); setNewTag(''); }
  };

  const delTag = async (name) => {
    const r = await api(`/tags/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (r.ok) setTags(ts => ts.filter(t => t.name !== name));
  };

  const addCat = async () => {
    if (!newCat.id || !newCat.label) return;
    const r = await api('/categories', { method: 'POST', body: JSON.stringify(newCat) });
    if (r.ok) { api('/categories').then(r2 => { if (r2.ok) setCats(r2.data); }); setNewCat({id:'',label:'',color:'#39ff14'}); }
  };

  return (
    <>
      <h1 className="page-title" style={{marginBottom:24}}>Categorías y Tags</h1>
      <div className="two-col">
        <div>
          <div className="card">
            <h3 style={{margin:'0 0 16px',fontSize:14,fontWeight:600}}>Categorías ({cats.length})</h3>
            <table className="table">
              <thead><tr><th>ID</th><th>Nombre</th><th>Posts</th><th></th></tr></thead>
              <tbody>
                {cats.map(c => (
                  <tr key={c.id}>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:11}}>{c.id}</td>
                    <td><span style={{display:'inline-flex',alignItems:'center',gap:6}}><span style={{width:8,height:8,borderRadius:'50%',background:c.color,display:'inline-block'}}></span>{c.label}</span></td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{c.post_count||0}</td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{marginTop:16,display:'flex',gap:8,flexWrap:'wrap'}}>
              <input className="form-input" style={{flex:1,minWidth:80}} placeholder="id-cat" value={newCat.id} onChange={e=>setNewCat(n=>({...n,id:e.target.value}))} />
              <input className="form-input" style={{flex:2,minWidth:100}} placeholder="Nombre" value={newCat.label} onChange={e=>setNewCat(n=>({...n,label:e.target.value}))} />
              <input type="color" value={newCat.color} onChange={e=>setNewCat(n=>({...n,color:e.target.value}))} style={{width:36,height:36,padding:2,border:'1px solid var(--border)',borderRadius:6,cursor:'pointer'}} />
              <button className="btn primary" onClick={addCat}>Añadir</button>
            </div>
          </div>
        </div>
        <div>
          <div className="card">
            <h3 style={{margin:'0 0 16px',fontSize:14,fontWeight:600}}>Tags ({tags.length})</h3>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
              {tags.map(t => (
                <span key={t.name} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',border:'1px solid var(--border)',borderRadius:99,fontSize:12}}>
                  #{t.name} <span style={{fontSize:10,color:'var(--text-faint)'}}>{t.post_count}</span>
                  <button onClick={()=>delTag(t.name)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-faint)',fontSize:14,lineHeight:1,padding:'0 0 0 4px'}}>×</button>
                </span>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <input className="form-input" style={{flex:1}} placeholder="nuevo-tag" value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTag()} />
              <button className="btn primary" onClick={addTag}>Añadir</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Media ──────────────────────────────────────────────────────
function Media() {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { api('/media').then(r => { if (r.ok) setFiles(r.data||[]); }); }, []);

  const upload = async (file) => {
    setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch('api/media', { method: 'POST', headers: { 'X-CSRF-Token': _csrfToken }, body: fd }).then(r=>r.json());
      if (res.ok) { const r2 = await api('/media'); if (r2.ok) setFiles(r2.data||[]); }
    } finally { setUploading(false); }
  };

  const del = async (id) => {
    const r = await api(`/media/${id}`, { method: 'DELETE' });
    if (r.ok) setFiles(fs => fs.filter(f => f.id !== id));
  };

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Multimedia</h1><div className="page-sub">{files.length} archivos</div></div>
      </div>
      <div
        className={`drop-zone${dragging ? ' dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)upload(f);}}
      >
        <div className="icon">📎</div>
        <p>{uploading ? 'Subiendo…' : 'Arrastra una imagen o haz click para seleccionar'}</p>
        <p style={{fontSize:12}}>JPEG, PNG, GIF, WebP · máx 10 MB</p>
        <input ref={inputRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{if(e.target.files[0])upload(e.target.files[0]);}} />
      </div>
      <div className="media-grid">
        {files.map(f => (
          <div key={f.id} className="media-item">
            <div className="media-thumb">
              <img src={f.url} alt={f.original_name} onError={e=>e.target.style.display='none'} />
            </div>
            <div className="media-info">
              <div className="media-name">{f.original_name}</div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                <span style={{fontSize:10,color:'var(--text-faint)'}}>{f.mime_type?.split('/')[1]?.toUpperCase()}</span>
                <button onClick={()=>del(f.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--danger)',fontSize:12}}>×</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Comments ───────────────────────────────────────────────────
function Comments() {
  const [comments, setComments] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api(`/comments?filter=${filter}`).then(r => { if (r.ok) setComments(r.data||[]); }).finally(()=>setLoading(false));
  }, [filter]);

  useEffect(load, [load]);

  const action = async (id, status) => {
    const r = await api(`/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (r.ok) setComments(cs => cs.map(c => c.id === id ? { ...c, status } : c));
  };

  const del = async (id) => {
    const r = await api(`/comments/${id}`, { method: 'DELETE' });
    if (r.ok) setComments(cs => cs.filter(c => c.id !== id));
  };

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Comentarios</h1></div>
      </div>
      <div className="card" style={{padding:0}}>
        <div className="toolbar">
          <select value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="spam">Spam</option>
          </select>
        </div>
        {loading ? <div style={{padding:24,color:'var(--text-dim)',fontSize:13}}>Cargando…</div> :
          comments.length === 0 ? <div style={{padding:24,color:'var(--text-dim)',fontSize:13}}>No hay comentarios en esta vista.</div> :
          comments.map(c => (
            <div key={c.id} className={`thread${c.status==='pending'?' unread':''}`}>
              <div className="avatar">{(c.author_name||'?')[0].toUpperCase()}</div>
              <div className="body">
                <div className="meta">
                  <span className="name">{c.author_name}</span>
                  <span className="when">{c.created_at?.slice(0,10)}</span>
                  <span className="on">en {c.post_id}</span>
                  <span className={`pill ${c.status}`}>{c.status}</span>
                </div>
                <div className="msg-body">{c.body}</div>
                <div className="thread-actions">
                  {c.status !== 'approved' && <button className="btn sm" onClick={()=>action(c.id,'approved')}>Aprobar</button>}
                  {c.status !== 'spam'     && <button className="btn sm" onClick={()=>action(c.id,'spam')}>Spam</button>}
                  <button className="btn sm danger" onClick={()=>del(c.id)}>Eliminar</button>
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ── Messages ───────────────────────────────────────────────────
function Messages() {
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/messages').then(r => { if (r.ok) setMsgs(r.data||[]); }).finally(()=>setLoading(false));
  }, []);

  const archive = async (id) => {
    const r = await api(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ is_archived: 1, is_read: 1 }) });
    if (r.ok) setMsgs(ms => ms.filter(m => m.id !== id));
  };

  const del = async (id) => {
    if (!confirm('¿Eliminar este mensaje?')) return;
    const r = await api(`/messages/${id}`, { method: 'DELETE' });
    if (r.ok) setMsgs(ms => ms.filter(m => m.id !== id));
  };

  const markRead = (id) => api(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ is_read: 1 }) });

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Mensajes</h1><div className="page-sub">{msgs.filter(m=>!m.is_read).length} sin leer</div></div>
      </div>
      <div className="card" style={{padding:0}}>
        {loading ? <div style={{padding:24,color:'var(--text-dim)',fontSize:13}}>Cargando…</div> :
          msgs.length === 0 ? <div style={{padding:24,color:'var(--text-dim)',fontSize:13}}>No hay mensajes.</div> :
          msgs.map(m => (
            <div key={m.id} className={`thread${!m.is_read?' unread':''}`} onClick={()=>markRead(m.id)}>
              <div className="avatar">{(m.sender_name||'?')[0].toUpperCase()}</div>
              <div className="body">
                <div className="meta">
                  <span className="name">{m.sender_name}</span>
                  <span className="when">{m.created_at?.slice(0,10)}</span>
                  <span className="on">{m.sender_email}</span>
                  {!m.is_read && <span className="pill pending">nuevo</span>}
                </div>
                {m.subject && <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{m.subject}</div>}
                <div className="msg-body">{m.body}</div>
                <div className="thread-actions">
                  <button className="btn sm" onClick={()=>archive(m.id)}>Archivar</button>
                  <button className="btn sm danger" onClick={()=>del(m.id)}>Eliminar</button>
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ── Analytics ──────────────────────────────────────────────────
function Analytics() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    api(`/analytics?days=${days}`).then(r => { if (r.ok) setData(r.data); });
  }, [days]);

  const bars = data?.daily || [];
  const maxV = Math.max(1, ...bars.map(b => b.views));

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Analytics</h1></div>
        <div className="page-actions">
          {[7,30,60,90].map(d => <button key={d} className={`btn${days===d?' primary':''}`} onClick={()=>setDays(d)}>{d}d</button>)}
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat"><div className="label">Visitas ({days}d)</div><div className="value">{data ? Number(data.totals?.total_views||0).toLocaleString() : '—'}</div></div>
        <div className="stat"><div className="label">Posts publicados</div><div className="value">{data?.totals?.posts ?? '—'}</div></div>
        <div className="stat"><div className="label">Comentarios</div><div className="value">{data?.totals?.comments ?? '—'}</div></div>
        <div className="stat"><div className="label">Mensajes</div><div className="value">{data?.totals?.messages ?? '—'}</div></div>
      </div>
      <div className="card" style={{marginBottom:20}}>
        <h3 style={{margin:'0 0 12px',fontSize:14,fontWeight:600}}>Visitas por día</h3>
        <div className="chart">{bars.map((b,i) => <div key={i} className="bar" style={{height:`${(b.views/maxV)*100}%`}} title={`${b.date}: ${b.views}`}></div>)}</div>
      </div>
      <div className="card" style={{padding:0}}>
        <h3 style={{margin:0,fontSize:14,fontWeight:600,padding:'20px 20px 12px'}}>Posts más vistos</h3>
        {(data?.top_posts||[]).map(p => (
          <div key={p.id} className="card-row" style={{padding:'10px 20px'}}>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.title}</div></div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text-dim)',flexShrink:0}}>{Number(p.views).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Settings ───────────────────────────────────────────────────
function Settings() {
  const [active, setActive] = useState('profile');
  const [vals, setVals] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const GROUPS = [
    { id:'profile',  label:'Perfil' },
    { id:'site',     label:'Sitio' },
    { id:'social',   label:'Social' },
    { id:'comments', label:'Comentarios' },
    { id:'advanced', label:'Avanzado' },
  ];

  const FIELDS = {
    profile:  [['profile_name','Nombre'],['profile_email','Email'],['profile_bio','Bio']],
    site:     [['site_title','Título'],['site_description','Descripción'],['site_domain','Dominio'],['site_posts_per_page','Posts por página']],
    social:   [['social_github','GitHub'],['social_mastodon','Mastodon'],['social_rss','RSS'],['social_email','Email público']],
    comments: [['comments_enabled','Comentarios habilitados'],['rss_enabled','RSS habilitado']],
    advanced: [['analytics_enabled','Analytics habilitado'],['webhook_url','Webhook URL']],
  };

  useEffect(() => {
    api('/settings').then(r => { if (r.ok) setVals(r.data); });
  }, []);

  const save = async () => {
    setSaving(true); setSaved(false);
    const payload = {};
    (FIELDS[active]||[]).forEach(([k]) => { if (k in vals) payload[k] = vals[k]; });
    await api(`/settings/${active}`, { method: 'PATCH', body: JSON.stringify(payload) });
    setSaving(false); setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  };

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Configuración</h1></div>
        <div className="page-actions">
          <button className="btn primary" onClick={save} disabled={saving}>{saving?'Guardando…':saved?'✓ Guardado':'Guardar'}</button>
        </div>
      </div>
      <div className="settings-layout">
        <div className="settings-nav">
          {GROUPS.map(g => <div key={g.id} className={`settings-nav-item${active===g.id?' active':''}`} onClick={()=>setActive(g.id)}>{g.label}</div>)}
        </div>
        <div className="settings-section card">
          {(FIELDS[active]||[]).map(([key, label]) => (
            <div key={key} className="form-group">
              <label className="form-label">{label}</label>
              <input className="form-input" value={vals[key]||''} onChange={e=>setVals(v=>({...v,[key]:e.target.value}))} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Shell ──────────────────────────────────────────────────────
const NAV = [
  { id:'dashboard', label:'Dashboard', ico:'📊', section:'contenido' },
  { id:'posts',     label:'Posts',     ico:'📝', section:'contenido' },
  { id:'tags',      label:'Categorías/Tags', ico:'🏷️', section:'contenido' },
  { id:'media',     label:'Multimedia', ico:'🖼️', section:'contenido' },
  { id:'comments',  label:'Comentarios', ico:'💬', section:'interaccion' },
  { id:'messages',  label:'Mensajes',  ico:'✉️', section:'interaccion' },
  { id:'analytics', label:'Analytics', ico:'📈', section:'sistema' },
  { id:'settings',  label:'Configuración', ico:'⚙️', section:'sistema' },
];

function AdminShell({ username, onLogout }) {
  const [view,      setView]  = useState('dashboard');
  const [collapsed, setCol]   = useState(false);
  const [editPost,  setEdit]  = useState(null);
  const [newPost,   setNew]   = useState(false);

  const theme = () => {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme')==='dark' ? 'light' : 'dark');
    localStorage.setItem('admin-theme', html.getAttribute('data-theme'));
  };

  useEffect(() => {
    const t = localStorage.getItem('admin-theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  }, []);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    onLogout();
  };

  const goNew  = () => { setEdit(null); setNew(true); setView('editor'); };
  const goEdit = (p) => { setEdit(p); setNew(false); setView('editor'); };
  const saved  = () => { setView('posts'); setEdit(null); setNew(false); };

  const sections = [...new Set(NAV.map(n=>n.section))];

  let content;
  if (view === 'editor')   content = <Editor initial={editPost} onSaved={saved} onBack={()=>setView('posts')} />;
  else if (view === 'dashboard') content = <Dashboard onNewPost={goNew} />;
  else if (view === 'posts')     content = <PostsList onEdit={goEdit} onNew={goNew} />;
  else if (view === 'tags')      content = <TagsManager />;
  else if (view === 'media')     content = <Media />;
  else if (view === 'comments')  content = <Comments />;
  else if (view === 'messages')  content = <Messages />;
  else if (view === 'analytics') content = <Analytics />;
  else if (view === 'settings')  content = <Settings />;

  return (
    <div className={`shell${collapsed?' collapsed':''}`}>
      <div className="sidebar">
        <div className="sb-brand">
          <div className="mark">J</div>
          <div className="name">jr<span className="dim">·</span>admin</div>
        </div>
        <div className="sb-nav">
          {sections.map(sec => (
            <div key={sec} className="sb-section">
              <div className="label">{sec}</div>
              {NAV.filter(n=>n.section===sec).map(n => (
                <div key={n.id} className={`sb-item${view===n.id||view==='editor'&&n.id==='posts'?' active':''}`} onClick={()=>setView(n.id)}>
                  <span className="ico">{n.ico}</span>
                  <span className="lbl">{n.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="sb-footer">
          <div className="sb-user">
            <div className="avatar">{(username||'A')[0].toUpperCase()}</div>
            <div className="info"><div className="uname">{username}</div><div className="role">Administrador</div></div>
          </div>
          <div className="sb-actions">
            <button className="sb-icon-btn" onClick={()=>setCol(c=>!c)} title="Colapsar">☰</button>
            <button className="sb-icon-btn" onClick={theme} title="Tema">◑</button>
            <button className="sb-icon-btn" onClick={logout} title="Salir">⏻</button>
          </div>
        </div>
      </div>
      <div className="main">
        <div className="page">{content}</div>
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api('/auth/me').then(r => {
      if (r.ok) { _csrfToken = r.data.csrf_token; setUser(r.data.username); }
    }).finally(() => setChecking(false));
  }, []);

  if (checking) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--text-faint)',fontSize:13}}>Cargando…</div>;
  if (!user)    return <LoginScreen onLogin={u => setUser(u)} />;
  return <AdminShell username={user} onLogout={() => setUser(null)} />;
}

ReactDOM.createRoot(document.getElementById('admin-root')).render(<App />);
