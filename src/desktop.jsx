// ─── Desktop Component ─────────────────────────────────────────
(function() {
const { useState: useS, useEffect, useRef, useCallback } = React;

const APPS = [
  { id: 'about',    title: 'Acerca de mí',     icon: '👤', w: 520, h: 580, desktop: true  },
  { id: 'reader',   title: 'Lector',            icon: '📖', w: 760, h: 540, desktop: true  },
  { id: 'files',    title: 'Archivo de posts',  icon: '📁', w: 720, h: 460, desktop: true  },
  { id: 'terminal', title: 'Terminal',           icon: '⌨',  w: 620, h: 380, desktop: true  },
  { id: 'notes',    title: 'Notas',             icon: '📝', w: 420, h: 520, desktop: true  },
  { id: 'mail',     title: 'Contacto',          icon: '✉',  w: 480, h: 540, desktop: true  },
  { id: 'search',   title: 'Buscar',            icon: '🔍', w: 560, h: 480, desktop: false },
  { id: 'tags',     title: 'Tags & Categorías', icon: '🏷️', w: 540, h: 520, desktop: false },
  { id: 'calendar', title: 'Calendario',        icon: '🗓',  w: 520, h: 480, desktop: false },
  { id: 'gallery',  title: 'Galería',           icon: '🖼',  w: 560, h: 480, desktop: false },
  { id: 'comments', title: 'Comentarios',       icon: '💬', w: 520, h: 440, desktop: false },
  { id: 'settings', title: 'Ajustes',           icon: '⚙️', w: 340, h: 380, desktop: false },
];

// ─── Boot screen (kernel log style) ──────────────────────────
function BootScreen({ onDone }) {
  const [lines, setLines] = useS([]);

  useEffect(() => {
    const log = [
      '[ 0.001 ] booting jr-os 6.8.0-neon',
      '[ 0.024 ] loading kernel modules…',
      '[ 0.118 ] mounting /home/jr',
      '[ 0.241 ] starting jrCinnamon WM',
      '[ 0.512 ] connecting to jrobertoma.com … OK',
      '[ 0.788 ] launching desktop session',
      '[ 1.024 ] welcome back, jr.'
    ];
    log.forEach((l, i) => {
      setTimeout(() => setLines(prev => [...prev, l]), 200 + i * 320);
    });
    setTimeout(onDone, 3900);
  }, []);

  return (
    <div className="boot">
      <div className="boot-logo">jr<span style={{ color: 'var(--neon-2)' }}>·</span>os</div>
      <div className="boot-sub">jrobertoma.com</div>
      <div className="boot-log">
        {lines.map((l, i) => (
          <div key={i}><span className="ok">[ OK ]</span> {l.split('] ')[1]}</div>
        ))}
        <div className="boot-cursor"></div>
      </div>
    </div>
  );
}

// ─── Clock ───────────────────────────────────────────────────
function Clock() {
  const [now, setNow] = useS(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="clock">
      {String(now.getHours()).padStart(2,'0')}:{String(now.getMinutes()).padStart(2,'0')}
    </span>
  );
}

const MAX_POST_WINDOWS = 4;

function Desktop({ tweaks, setTweak }) {
  const wm = window.useWindowManager();
  // Un enlace compartido (#/post/id) va directo al post, sin animación de arranque
  const sharedPostId = (location.hash.match(/^#\/post\/(.+)$/) || [])[1];
  const [booted,     setBooted]  = useS(!tweaks.showBoot || !!sharedPostId);
  const [menuOpen,   setMenu]    = useS(false);
  const [menuQuery,  setMQ]      = useS('');
  const [commentsPostId, setCommentsPostId] = useS(null);
  const [ctxMenu,    setCtxMenu] = useS(null);
  const [soundOn,    setSoundOn] = useS(tweaks.soundsOn !== false);
  const audioCtxRef = useRef(null);
  const openAppRef  = useRef(null);

  // Click sound
  const click = useCallback(() => {
    if (!soundOn) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.06);
    } catch(e) {}
  }, [soundOn]);

  // Wallpaper variant inline style
  const wallVar = tweaks.wallpaper === 'matrix' ? {
    backgroundImage: 'radial-gradient(ellipse at 50% 50%, rgba(57,255,20,0.15), transparent 60%), linear-gradient(180deg, #000, #050605)'
  } : tweaks.wallpaper === 'sunset' ? {
    backgroundImage: 'radial-gradient(ellipse at 50% 80%, rgba(255,100,80,0.25), transparent 60%), radial-gradient(ellipse at 50% 30%, rgba(120,40,180,0.2), transparent 60%), linear-gradient(180deg, #1a0820, #0a0410)'
  } : {};

  const openPost = useCallback((postId) => {
    const winId = `post-${postId}`;
    const existing = wm.windows.find(w => w.id === winId);
    if (existing) { wm.focusWindow(winId); return; }
    const postCount = wm.windows.filter(w => w.id.startsWith('post-')).length;
    if (postCount >= MAX_POST_WINDOWS) return;
    const post = (window.BLOG_POSTS || []).find(p => p.id === postId);
    if (!post) return;
    click();
    wm.openWindow({
      id: winId,
      title: post.title,
      icon: '📄',
      content: <window.PostApp postId={postId} onOpenComments={(pid) => { setCommentsPostId(pid); openAppRef.current?.('comments'); }} />,
      width: 640, height: 480,
    });
  }, [wm, click]);

  const openApp = useCallback((appId) => {
    const app = APPS.find(a => a.id === appId);
    if (!app) return;
    click();
    setMenu(false);

    let content;
    if      (appId === 'reader')   content = <window.ReaderApp onOpenComments={(pid) => { setCommentsPostId(pid); openAppRef.current?.('comments'); }} />;
    else if (appId === 'comments') content = <window.CommentsApp postId={commentsPostId} />;
    else if (appId === 'files')    content = <window.FilesApp onOpenPost={openPost} />;
    else if (appId === 'notes')    content = <window.NotesApp />;
    else if (appId === 'tags')     content = <window.TagsApp openPost={openPost} />;
    else if (appId === 'search')   content = <window.SearchApp openPost={openPost} />;
    else if (appId === 'calendar') content = <window.CalendarApp />;
    else if (appId === 'gallery')  content = <window.GalleryApp />;
    else if (appId === 'terminal') content = <window.TerminalApp />;
    else if (appId === 'mail')     content = <window.MailApp />;
    else if (appId === 'about')    content = <window.AboutApp />;

    wm.openWindow({ id: appId, title: app.title, icon: app.icon, content, width: app.w, height: app.h });
  }, [wm, click, commentsPostId, openPost]);

  openAppRef.current = openApp;

  // Al arrancar: abre el post enlazado o, si no hay, "Acerca de mí"
  useEffect(() => {
    if (!booted) return;
    const id = sharedPostId && decodeURIComponent(sharedPostId);
    setTimeout(() => (id ? openPost(id) : openApp('about')), 300);
  }, [booted]);

  const filteredApps = APPS.filter(a => !menuQuery || a.title.toLowerCase().includes(menuQuery.toLowerCase()));

  const focusedId = wm.windows.reduce((a, b) => (!a || b.z > a.z) && !b.minimized ? b : a, null)?.id;

  const closeAll = () => { setMenu(false); setCtxMenu(null); };

  if (!booted) {
    return (
      <div className="desktop">
        <BootScreen onDone={() => setBooted(true)} />
      </div>
    );
  }

  return (
    <div className="desktop" onClick={closeAll}>
      {/* Wallpaper */}
      <div className="wallpaper" style={wallVar}>
        {tweaks.wallpaper !== 'matrix' && (
          <div className="wallpaper-logo">
            <div className="name">jrobertoma</div>
            <div className="tag">// software · hardware · etc</div>
          </div>
        )}
        {tweaks.wallpaper === 'matrix' && <window.MatrixRain />}
      </div>

      {/* Desktop icons */}
      <div className="desk-icons">
        {APPS.filter(a => a.desktop).map(app => (
          <div key={app.id} className="desk-icon" onClick={() => openApp(app.id)} onDoubleClick={() => openApp(app.id)}>
            <div className="ico">{app.icon}</div>
            <div className="lbl">{app.title}</div>
          </div>
        ))}
      </div>

      {/* Windows */}
      {wm.windows.map(win => (
        <window.Window
          key={win.id}
          win={win}
          focused={win.id === focusedId}
          onClose={()     => wm.closeWindow(win.id)}
          onFocus={()     => wm.focusWindow(win.id)}
          onMinimize={()  => wm.toggleMinimize(win.id)}
          onMaximize={()  => wm.toggleMaximize(win.id)}
          onMove={(x,y)   => wm.moveWindow(win.id, x, y)}
          onResize={(w,h) => wm.resizeWindow(win.id, w, h)}
          playSound={click}
        />
      ))}

      {/* Start menu */}
      {menuOpen && (
        <div className="start-menu" onClick={e => e.stopPropagation()}>
          <div className="sm-header">
            <div className="sm-avatar">JR</div>
            <div className="sm-user">
              <div className="name">jr@jrobertoma.com</div>
              <div className="domain">// session active</div>
            </div>
          </div>
          <div className="sm-search">
            <span style={{ color: 'var(--neon)' }}>⌕</span>
            <input autoFocus placeholder="buscar app o comando…"
              value={menuQuery} onChange={e => setMQ(e.target.value)} />
          </div>
          <div className="sm-grid">
            {filteredApps.map(a => (
              <div key={a.id} className="sm-item" onClick={() => openApp(a.id)}>
                <div className="ico">{a.icon}</div>
                <div className="lbl">{a.title}</div>
              </div>
            ))}
          </div>
          <div className="sm-footer">
            <span onClick={() => openApp('about')}>perfil</span>
            <span onClick={() => openApp('terminal')}>terminal</span>
            <span style={{ marginLeft: 'auto' }} onClick={() => { setBooted(false); setTimeout(() => setBooted(true), 50); }}>↻ reiniciar</span>
          </div>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="ctx-menu"
          style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y - 72, zIndex: 99999 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="ctx-menu-item" onClick={() => { wm.centerWindow(ctxMenu.winId); setCtxMenu(null); }}>
            Restaurar al centro
          </div>
          <div className="ctx-menu-item danger" onClick={() => { wm.closeWindow(ctxMenu.winId); setCtxMenu(null); }}>
            Cerrar
          </div>
        </div>
      )}

      {/* Taskbar */}
      <div className="taskbar" onClick={e => { e.stopPropagation(); setCtxMenu(null); }}>
        <div className="tb-menu" onClick={e => { e.stopPropagation(); setCtxMenu(null); setMenu(o => !o); }}>
          <span className="dot"></span>
          <span>jr-os</span>
        </div>
        <div className="tb-windows">
          {wm.windows.map(win => (
            <div
              key={win.id}
              className={`tb-window${win.id === focusedId ? ' active' : ''}${win.minimized ? ' minimized' : ''}`}
              onClick={() => {
                if (win.minimized) wm.focusWindow(win.id);
                else if (win.id === focusedId) wm.toggleMinimize(win.id);
                else wm.focusWindow(win.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCtxMenu({ winId: win.id, x: e.clientX, y: e.clientY });
              }}
            >
              <span className="icon">{win.icon}</span>
              <span className="label">{win.title}</span>
            </div>
          ))}
        </div>
        <div className="tb-systray">
          <span className="sysicon" title="wifi">⌬</span>
          <span className="sysicon" title="sonido" onClick={e => { e.stopPropagation(); setSoundOn(s => !s); }}>
            {soundOn ? '🔊' : '🔇'}
          </span>
          <Clock />
        </div>
      </div>
    </div>
  );
}

// MatrixRain exposed for wallpaper
function MatrixRain() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const cols  = Math.floor(canvas.width / 14);
    const drops = Array(cols).fill(1);
    const chars = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃ01ABCDEF';
    let raf;
    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#39ff14';
      ctx.font = '13px monospace';
      drops.forEach((y, i) => {
        const c = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(c, i * 14, y * 14);
        if (y * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} className="matrix-canvas" style={{ width: '100%', height: '100%' }} />;
}

window.Desktop   = Desktop;
window.MatrixRain = MatrixRain;
})();
