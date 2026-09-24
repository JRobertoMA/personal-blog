// ─── Pixel Mobile Component ────────────────────────────────────
(function() {
const { useState: usePS, useEffect: usePE } = React;

// ─── Settings App ─────────────────────────────────────────────
function PixelSettingsApp({ tweaks, setTweak }) {
  const section = { marginBottom: 24 };
  const label = { display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 };

  const wallpapers = [['neon','Neón'], ['matrix','Matrix'], ['sunset','Sunset']];
  const accents    = [['neon-green','Verde'], ['cyan','Cian'], ['magenta','Magenta'], ['amber','Ámbar']];

  const pill = (active) => ({
    padding: '6px 14px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
    background: active ? 'var(--neon)' : 'rgba(255,255,255,0.07)',
    color: active ? '#000' : 'var(--text-dim)',
    border: 'none', fontFamily: 'var(--font-ui)',
    transition: 'all 0.15s',
  });

  const toggleRow = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' };

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div style={section}>
        <span style={label}>Wallpaper</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {wallpapers.map(([v, l]) => (
            <button key={v} style={pill(tweaks.wallpaper === v)} onClick={() => setTweak('wallpaper', v)}>{l}</button>
          ))}
        </div>
      </div>
      <div style={section}>
        <span style={label}>Color de acento</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {accents.map(([v, l]) => (
            <button key={v} style={pill(tweaks.accent === v)} onClick={() => setTweak('accent', v)}>{l}</button>
          ))}
        </div>
      </div>
      <div style={section}>
        <span style={label}>Sistema</span>
        <div style={toggleRow}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Animación de arranque</span>
          <div
            style={{ width: 40, height: 22, borderRadius: 11, background: tweaks.showBoot ? 'var(--neon)' : 'rgba(255,255,255,0.15)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
            onClick={() => setTweak('showBoot', !tweaks.showBoot)}
          >
            <div style={{ position: 'absolute', top: 3, left: tweaks.showBoot ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Lock Screen ──────────────────────────────────────────────
function LockScreen({ time, dateStr, onUnlock }) {
  const posts  = window.BLOG_POSTS || [];
  const latest = posts[0];
  return (
    <div className="pixel-lock">
      <div className="clock">{time}</div>
      <div className="date">{dateStr}</div>
      {latest && (
        <div className="pixel-notif" onClick={onUnlock}>
          <div className="from">jrobertoma · ahora</div>
          <div className="title">Nuevo post: {latest.title}</div>
          <div className="preview">{(latest.excerpt || '').slice(0, 60)}…</div>
        </div>
      )}
      <div className="hint">
        <span className="swipe">↑</span>
        desliza para abrir
      </div>
      <div onClick={onUnlock} style={{ position: 'absolute', inset: 0, zIndex: -1 }}></div>
      <div onClick={onUnlock} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 200, zIndex: 1 }}></div>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────
function HomeView({ time, dateStr, setView }) {
  const APPS = [
    { label: 'Blog',     ico: '📰', bg: 'linear-gradient(135deg,#39ff14,#1a8800)', action: () => setView('blog')     },
    { label: 'Sobre mí', ico: '👤', bg: 'linear-gradient(135deg,#00f0ff,#006080)', action: () => setView('about')    },
    { label: 'Terminal', ico: '⌨',  bg: 'linear-gradient(135deg,#1c1f25,#000)',    action: () => setView('terminal') },
    { label: 'Buscar',   ico: '🔍', bg: 'linear-gradient(135deg,#ff00d4,#800070)', action: () => setView('blog')     },
    { label: 'Tags',     ico: '🏷️', bg: 'linear-gradient(135deg,#2a1f00,#1a1000)', action: () => setView('blog')     },
    { label: 'Galería',  ico: '🖼',  bg: 'linear-gradient(135deg,#1a1a2a,#0d0d18)', action: () => {}                 },
    { label: 'Notas',    ico: '📝', bg: 'linear-gradient(135deg,#1a2a1a,#0d180d)', action: () => {}                  },
    { label: 'Contacto', ico: '✉',  bg: 'linear-gradient(135deg,#2a0d0d,#180808)', action: () => setView('settings') },
  ];
  return (
    <div className="pixel-home">
      <div className="pixel-clock-widget">
        <div className="time">{time}</div>
        <div className="date">{dateStr}</div>
      </div>
      <div className="pixel-search">
        <span style={{ color: 'var(--neon)' }}>⌕</span>
        <span>busca en jrobertoma.com</span>
      </div>
      <div className="pixel-apps">
        {APPS.map((a, i) => (
          <div key={i} className="pixel-app" onClick={a.action}>
            <div className="ico" style={{ background: a.bg }}>{a.ico}</div>
            <div className="lbl">{a.label}</div>
          </div>
        ))}
      </div>
      <div className="pixel-dock">
        <div className="pixel-app" onClick={() => setView('home')}>
          <div className="ico">🏠</div>
        </div>
        <div className="pixel-app" onClick={() => setView('blog')}>
          <div className="ico">📰</div>
        </div>
        <div className="pixel-app" onClick={() => setView('about')}>
          <div className="ico">👤</div>
        </div>
        <div className="pixel-app" onClick={() => setView('terminal')}>
          <div className="ico">⌨</div>
        </div>
      </div>
    </div>
  );
}

// ─── Blog View ────────────────────────────────────────────────
function BlogView({ cat, setCat, openPost, setView }) {
  const posts    = window.BLOG_POSTS || [];
  const cats     = window.BLOG_CATEGORIES || [];
  const filtered = cat === 'all' ? posts : posts.filter(p => p.category_id === cat);
  return (
    <div className="pixel-app-view">
      <div className="pixel-app-header">
        <div className="back" onClick={() => setView('home')}>←</div>
        <div className="title">Blog</div>
      </div>
      <div className="pixel-blog-tabs">
        <div className={`tab${cat === 'all' ? ' active' : ''}`} onClick={() => setCat('all')}>todos</div>
        {cats.map(c => (
          <div key={c.id} className={`tab${cat === c.id ? ' active' : ''}`} onClick={() => setCat(c.id)}>
            {c.label}
          </div>
        ))}
      </div>
      <div className="pixel-app-body">
        {filtered.map(p => (
          <div key={p.id} className="pixel-post-card" onClick={() => openPost(p.id)}>
            <div className="cat">{p.category_label || p.category_id}</div>
            <div className="title">{p.title}</div>
            <div className="excerpt">{p.excerpt}</div>
            <div className="footer">
              <span>{p.date}</span>
              <span>{(p.tags || []).map(t => '#' + t).join(' · ')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Post View ────────────────────────────────────────────────
function PostView({ postId, setView }) {
  const p = (window.BLOG_POSTS || []).find(x => x.id === postId);
  if (!p) return null;
  return (
    <div className="pixel-app-view">
      <div className="pixel-app-header">
        <div className="back" onClick={() => setView('blog')}>←</div>
        <div className="title" style={{ fontSize: 14 }}>Post</div>
      </div>
      <div className="pixel-app-body">
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--neon)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {p.category_label || p.category_id} · {p.date}
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '8px 0 12px', lineHeight: 1.2 }}>{p.title}</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {(p.tags || []).map(t => <span key={t} className="tag-pill">#{t}</span>)}
        </div>
        {(p.body || '').split('\n\n').map((para, i) => {
          if (para.startsWith('```')) {
            const code = para.replace(/```\w*\n?/, '').replace(/```$/, '');
            return <pre key={i} style={{ background: '#000', border: '1px solid var(--border)', borderRadius: 4, padding: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--neon)', overflow: 'auto' }}>{code}</pre>;
          }
          return <p key={i} style={{ fontSize: 13.5, lineHeight: 1.6, margin: '0 0 12px' }}>{para}</p>;
        })}
      </div>
    </div>
  );
}

// ─── App Shell (about / terminal / settings) ──────────────────
function AppShell({ title, onBack, bodyPadding, children }) {
  return (
    <div className="pixel-app-view">
      <div className="pixel-app-header">
        <div className="back" onClick={onBack}>←</div>
        <div className="title">{title}</div>
      </div>
      <div className="pixel-app-body" style={{ padding: bodyPadding !== false ? 16 : 0 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Main Pixel Component ─────────────────────────────────────
function Pixel({ tweaks, setTweak }) {
  const [view,   setView]   = usePS('lock');
  const [postId, setPostId] = usePS(null);
  const [cat,    setCat]    = usePS('all');
  const [now,    setNow]    = usePS(new Date());

  usePE(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const time    = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' });

  const openPost = (id) => { setPostId(id); setView('post'); };

  const wallVar = tweaks.wallpaper === 'matrix' ? {
    backgroundImage: 'radial-gradient(ellipse at 50% 50%, rgba(57,255,20,0.15), transparent 60%), linear-gradient(180deg,#000,#050605)'
  } : tweaks.wallpaper === 'sunset' ? {
    backgroundImage: 'radial-gradient(ellipse at 50% 80%, rgba(255,100,80,0.25), transparent 60%), radial-gradient(ellipse at 50% 30%, rgba(120,40,180,0.2), transparent 60%), linear-gradient(180deg,#1a0820,#0a0410)'
  } : {};

  return (
    <div className="pixel-screen">
      <div className="pixel-wallpaper" style={wallVar}></div>

      {/* Barra de estado */}
      <div className="pixel-statusbar">
        <span>{time}</span>
        <div className="right">
          <span>5G</span>
          <span>▲ 100%</span>
        </div>
      </div>

      {/* Vista: bloqueo */}
      {view === 'lock' && (
        <LockScreen time={time} dateStr={dateStr} onUnlock={() => setView('home')} />
      )}

      {/* Vista: inicio */}
      {view === 'home' && (
        <HomeView time={time} dateStr={dateStr} setView={setView} />
      )}

      {/* Vista: blog */}
      {view === 'blog' && (
        <BlogView cat={cat} setCat={setCat} openPost={openPost} setView={setView} />
      )}

      {/* Vista: post */}
      {view === 'post' && postId && (
        <PostView postId={postId} setView={setView} />
      )}

      {/* Vista: sobre mí */}
      {view === 'about' && (
        <AppShell title="Sobre mí" onBack={() => setView('home')} bodyPadding={false}>
          <window.AboutApp />
        </AppShell>
      )}

      {/* Vista: terminal */}
      {view === 'terminal' && (
        <AppShell title="Terminal" onBack={() => setView('home')} bodyPadding={false}>
          <window.TerminalApp openPost={openPost} />
        </AppShell>
      )}

      {/* Vista: ajustes */}
      {view === 'settings' && (
        <AppShell title="Ajustes" onBack={() => setView('home')} bodyPadding={false}>
          <PixelSettingsApp tweaks={tweaks} setTweak={setTweak} />
        </AppShell>
      )}

      {/* Píldora de navegación */}
      <div className="pixel-navbar"><div className="pixel-pill"></div></div>
    </div>
  );
}

window.Pixel = Pixel;
})();
