// ─── Desktop Component ─────────────────────────────────────────
(function() {
const { useState: useS, useEffect, useRef, useCallback, useMemo } = React;

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
  { id: 'settings', title: 'Ajustes',           icon: '⚙️', w: 420, h: 500, desktop: false },
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
  const [ctxMenu,    setCtxMenu] = useS(null);
  const soundOn = tweaks.soundsOn !== false;   // se guarda con el resto de ajustes
  const audioCtxRef = useRef(null);
  // Lista de ventanas siempre actual, para funciones que viven dentro de ventanas ya abiertas
  const windowsRef = useRef(wm.windows);
  windowsRef.current = wm.windows;

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

  const wallVar = window.wallpaperStyle(tweaks.wallpaper);

  // Comentarios: una ventana por post (id "comments-<post>"), nunca una general.
  // Se abre desde el botón "Comentarios (N)" de cada post, no desde el menú inicio.
  const openComments = useCallback((postId) => {
    const post = (window.BLOG_POSTS || []).find(p => p.id === postId);
    if (!post) return;
    click();
    wm.openWindow({
      id: `comments-${postId}`,
      title: `Comentarios · ${post.title}`,
      icon: '💬',
      content: <window.CommentsApp postId={postId} />,
      width: 520, height: 480,
    });
  }, [wm, click]);

  // Galería: una ventana por imagen (id "image-<id>")
  const openImage = useCallback((file) => {
    if (!file) return;
    click();
    wm.openWindow({
      id: `image-${file.id}`,
      title: file.original_name || 'Imagen',
      icon: '🖼',
      content: <window.ImageViewerApp file={file} />,
      width: Math.min(900, Math.max(360, (file.width || 640) + 40)),
      height: Math.min(700, Math.max(300, (file.height || 480) + 90)),
    });
  }, [wm, click]);

  const openPost = useCallback((postId) => {
    const winId = `post-${postId}`;
    const windows  = windowsRef.current;
    const existing = windows.find(w => w.id === winId);
    if (existing) { wm.focusWindow(winId); return; }
    const postCount = windows.filter(w => w.id.startsWith('post-')).length;
    if (postCount >= MAX_POST_WINDOWS) return;
    const post = (window.BLOG_POSTS || []).find(p => p.id === postId);
    if (!post) return;
    click();
    wm.openWindow({
      id: winId,
      title: post.title,
      icon: '📄',
      content: <window.PostApp postId={postId} onOpenComments={act.openComments} />,
      width: 640, height: 480,
    });
  }, [wm, click, openComments]);

  const openApp = useCallback((appId) => {
    const app = APPS.find(a => a.id === appId);
    if (!app) return;
    click();
    setMenu(false);

    let content;
    // Las ventanas guardan su contenido al abrirse: se les pasan las funciones
    // estables de `act`, que siempre llaman a la versión actual.
    if      (appId === 'reader')   content = <window.ReaderApp onOpenComments={act.openComments} />;
    else if (appId === 'files')    content = <window.FilesApp onOpenPost={act.openPost} onOpenApp={act.openApp} />;
    else if (appId === 'notes')    content = <window.NotesApp />;
    else if (appId === 'tags')     content = <window.TagsApp openPost={act.openPost} />;
    else if (appId === 'search')   content = <window.SearchApp openPost={act.openPost} />;
    else if (appId === 'calendar') content = <window.CalendarApp openPost={act.openPost} />;
    else if (appId === 'gallery')  content = <window.GalleryApp onOpenImage={act.openImage} />;
    else if (appId === 'terminal') content = <window.TerminalApp openPost={act.openPost} />;
    else if (appId === 'settings') content = <window.SettingsApp />;
    else if (appId === 'mail')     content = <window.MailApp />;
    else if (appId === 'about')    content = <window.AboutApp />;

    wm.openWindow({ id: appId, title: app.title, icon: app.icon, content, width: app.w, height: app.h });
  }, [wm, click]);

  // Funciones estables para el contenido de las ventanas (evita closures congelados)
  const latest = useRef({});
  latest.current = { openPost, openComments, openApp, openImage };
  const act = useMemo(() => ({
    openPost:     (id)   => latest.current.openPost(id),
    openComments: (id)   => latest.current.openComments(id),
    openApp:      (id)   => latest.current.openApp(id),
    openImage:    (file) => latest.current.openImage(file),
  }), []);

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
            <div className="sm-avatar">{window.aboutInitials()}</div>
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
          <span className="sysicon" title={soundOn ? 'Silenciar' : 'Activar sonido'} onClick={e => { e.stopPropagation(); setTweak('soundsOn', !soundOn); }}>
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
    let raf, frame = 0;
    // Color del acento actual (se relee cada ~medio segundo por si cambia)
    const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--neon').trim() || '#39ff14';
    let color = accent();
    const draw = () => {
      if (++frame % 30 === 0) color = accent();
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;
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
