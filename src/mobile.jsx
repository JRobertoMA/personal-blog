// ─── Versión móvil ─────────────────────────────────────────────
// Lector de blog nativo para pantallas táctiles: cabecera fija, barra de
// pestañas inferior, rutas con hash (#/post/id) para que el botón "atrás"
// del teléfono funcione y los posts se puedan compartir.
(function() {
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ── Iconos SVG (heredan currentColor) ─────────────────────────
const Icon = ({ d, size = 22, fill = 'none', sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {[].concat(d).map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const I = {
  home:   ['M3 10.5 12 3l9 7.5', 'M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm20 20-4.2-4.2'],
  mail:   ['M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z', 'm3.5 7 8.5 6 8.5-6'],
  user:   ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21a8 8 0 0 1 16 0'],
  back:   ['M15 18l-6-6 6-6'],
  share:  ['M12 3v12', 'm7 8 5-5 5 5', 'M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5'],
  chat:   ['M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z'],
  term:   ['m5 8 4 4-4 4', 'M12 17h7'],
  chev:   ['m9 6 6 6-6 6'],
  x:      ['M18 6 6 18', 'M6 6l12 12'],
  up:     ['M12 19V5', 'm5 12 7-7 7 7'],
};

// ── Router por hash ───────────────────────────────────────────
function parseHash() {
  const raw = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
  const [section = '', ...rest] = raw.split('/');
  const param = rest.join('/');
  switch (section) {
    case 'post':      return { name: 'post', id: param };
    case 'buscar':    return { name: 'search', q: param };
    case 'tag':       return { name: 'search', q: '#' + param };
    case 'categoria': return { name: 'home', cat: param || 'all' };
    case 'contacto':  return { name: 'contact' };
    case 'sobre-mi':  return { name: 'about' };
    case 'terminal':  return { name: 'terminal' };
    default:          return { name: 'home', cat: 'all' };
  }
}
const go = (path) => { location.hash = '#/' + path; };

function useRoute(onLeave) {
  const [route, setRoute] = useState(parseHash);
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  useEffect(() => {
    // onLeave se ejecuta antes de re-renderizar: el DOM aún es la pantalla anterior
    const onHash = () => { leaveRef.current?.(); setRoute(parseHash()); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

// ── Utilidades ────────────────────────────────────────────────
const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
const catColor = (p) => p.category_color || 'var(--neon)';

// ── Piezas comunes ────────────────────────────────────────────
function TopBar({ title, onBack, right, brand }) {
  return (
    <header className="m-topbar">
      {onBack
        ? <button className="m-iconbtn" onClick={onBack} aria-label="Volver"><Icon d={I.back} /></button>
        : null}
      {brand
        ? <a className="m-brand" href="#/" aria-label="Inicio">jr<span>·</span>os</a>
        : <h1 className="m-topbar-title">{title}</h1>}
      <div className="m-topbar-right">{right}</div>
    </header>
  );
}

function TabBar({ active }) {
  const tabs = [
    { id: 'home',    label: 'Blog',     icon: I.home,   path: '' },
    { id: 'search',  label: 'Buscar',   icon: I.search, path: 'buscar' },
    { id: 'contact', label: 'Contacto', icon: I.mail,   path: 'contacto' },
    { id: 'about',   label: 'Sobre mí', icon: I.user,   path: 'sobre-mi' },
  ];
  return (
    <nav className="m-tabbar" aria-label="Navegación principal">
      {tabs.map(t => (
        <a key={t.id} href={'#/' + t.path}
          className={`m-tab${active === t.id ? ' active' : ''}`}
          aria-current={active === t.id ? 'page' : undefined}>
          <Icon d={t.icon} />
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

function PostCard({ p, featured }) {
  return (
    <a href={'#/post/' + encodeURIComponent(p.id)} className={`m-card${featured ? ' featured' : ''}`}
      style={{ '--cat': catColor(p) }}>
      <div className="m-card-meta">
        <span className="m-cat-dot" />
        <span className="m-card-cat">{p.category_label || p.category_id}</span>
        <span className="m-sep">·</span>
        <time dateTime={p.date}>{fmtDate(p.date)}</time>
      </div>
      <h2 className="m-card-title">{p.title}</h2>
      {p.excerpt && <p className="m-card-excerpt">{p.excerpt}</p>}
      <div className="m-card-foot">
        {(p.tags || []).slice(0, 3).map(t => <span key={t} className="m-tag">#{t}</span>)}
        {Number(p.comment_count) > 0 && (
          <span className="m-card-comments"><Icon d={I.chat} size={14} /> {p.comment_count}</span>
        )}
      </div>
    </a>
  );
}

function EmptyState({ title, children }) {
  return (
    <div className="m-empty">
      <div className="m-empty-title">{title}</div>
      {children && <div className="m-empty-body">{children}</div>}
    </div>
  );
}

// ── Inicio / listado ──────────────────────────────────────────
function HomeScreen({ cat }) {
  const posts = window.BLOG_POSTS || [];
  const cats  = (window.BLOG_CATEGORIES || []).filter(c => posts.some(p => p.category_id === c.id));
  const list  = cat === 'all' ? posts : posts.filter(p => p.category_id === cat);
  const chipsRef = useRef(null);

  useEffect(() => {
    const el = chipsRef.current?.querySelector('.active');
    el?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [cat]);

  return (
    <>
      <TopBar brand right={
        <a className="m-iconbtn" href="#/buscar" aria-label="Buscar"><Icon d={I.search} /></a>
      } />
      <main className="m-main" id="contenido">
        {cat === 'all' && (
          <section className="m-hero">
            <div className="m-avatar" aria-hidden="true">JR</div>
            <div>
              <div className="m-hero-name">J. Roberto M.</div>
              <div className="m-hero-tag">software · hardware · linux · etc</div>
            </div>
          </section>
        )}

        <div className="m-chips" ref={chipsRef} role="tablist" aria-label="Categorías">
          <a href="#/" role="tab" aria-selected={cat === 'all'} className={`m-chip${cat === 'all' ? ' active' : ''}`}>Todos</a>
          {cats.map(c => (
            <a key={c.id} href={'#/categoria/' + encodeURIComponent(c.id)} role="tab" aria-selected={cat === c.id}
              className={`m-chip${cat === c.id ? ' active' : ''}`} style={{ '--cat': c.color || 'var(--neon)' }}>
              {c.label}
            </a>
          ))}
        </div>

        {list.length === 0 ? (
          posts.length === 0
            ? <EmptyState title="No hay posts todavía">Si esperabas ver algo aquí, recarga la página en un momento.
                <button className="m-btn" onClick={() => location.reload()}>Recargar</button></EmptyState>
            : <EmptyState title="Nada en esta categoría" />
        ) : (
          <div className="m-list">
            {list.map((p, i) => <PostCard key={p.id} p={p} featured={i === 0 && cat === 'all'} />)}
          </div>
        )}
      </main>
    </>
  );
}

// ── Post ──────────────────────────────────────────────────────
function useReadingProgress(ref, dep) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const total = el.offsetTop + el.offsetHeight - window.innerHeight;
        setPct(total > 0 ? Math.min(100, Math.max(0, (window.scrollY / total) * 100)) : 100);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [ref, dep]);
  return pct;
}

function PostScreen({ id }) {
  const { post, loading, error } = window.usePost(id);
  const [showComments, setShowComments] = useState(false);
  const articleRef = useRef(null);
  const pct = useReadingProgress(articleRef, post?.body);
  const posts = window.BLOG_POSTS || [];
  const idx = posts.findIndex(p => p.id === id);
  const newer = idx > 0 ? posts[idx - 1] : null;
  const older = idx >= 0 && idx < posts.length - 1 ? posts[idx + 1] : null;

  useEffect(() => { window.trackView(id); setShowComments(false); }, [id]);
  useEffect(() => { if (post?.title) document.title = post.title + ' — jrobertoma'; return () => { document.title = 'jrobertoma.com'; }; }, [post?.title]);

  const back = () => (history.length > 1 ? history.back() : go(''));
  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: post?.title, url });
      else { await navigator.clipboard.writeText(url); window.__toast?.('Enlace copiado'); }
    } catch (e) {}
  };

  return (
    <>
      <div className="m-progress" style={{ transform: `scaleX(${pct / 100})` }} aria-hidden="true" />
      <TopBar title="" onBack={back} right={
        <button className="m-iconbtn" onClick={share} aria-label="Compartir"><Icon d={I.share} /></button>
      } />
      <main className="m-main m-main-post" id="contenido">
        {!post && loading && <div className="m-skeleton" aria-busy="true"><div /><div /><div /><div /></div>}
        {!post && !loading && (
          <EmptyState title="Post no encontrado">{error}<a className="m-btn" href="#/">Volver al blog</a></EmptyState>
        )}
        {post && (
          <article ref={articleRef} className="m-article" style={{ '--cat': catColor(post) }}>
            <a className="m-article-cat" href={'#/categoria/' + encodeURIComponent(post.category_id)}>
              <span className="m-cat-dot" />{post.category_label || post.category_id}
            </a>
            <h1 className="m-article-title">{post.title}</h1>
            <div className="m-article-meta">
              <time dateTime={post.date}>{fmtDate(post.date)}</time>
              {post.body && <><span className="m-sep">·</span>{window.readingTime(post.body)} min de lectura</>}
            </div>
            {(post.tags || []).length > 0 && (
              <div className="m-article-tags">
                {post.tags.map(t => <a key={t} className="m-tag" href={'#/tag/' + encodeURIComponent(t)}>#{t}</a>)}
              </div>
            )}

            {loading && !post.body
              ? <div className="m-skeleton" aria-busy="true"><div /><div /><div /></div>
              : <div className="m-prose" dangerouslySetInnerHTML={{ __html: window.renderMarkdown(post.body) }} />}

            <div className="m-article-end">
              <span>— Gracias por leer. JR</span>
              <button className="m-btn ghost" onClick={share}><Icon d={I.share} size={16} /> Compartir</button>
            </div>

            <section className="m-comments">
              {showComments
                ? <window.CommentsApp postId={id} />
                : <button className="m-btn block" onClick={() => setShowComments(true)}>
                    <Icon d={I.chat} size={18} /> Ver comentarios{Number(post.comment_count) > 0 ? ` (${post.comment_count})` : ''} y opinar
                  </button>}
            </section>

            {(newer || older) && (
              <nav className="m-prevnext" aria-label="Más posts">
                {older && <a href={'#/post/' + encodeURIComponent(older.id)}><small>← Anterior</small><span>{older.title}</span></a>}
                {newer && <a href={'#/post/' + encodeURIComponent(newer.id)} className="next"><small>Siguiente →</small><span>{newer.title}</span></a>}
              </nav>
            )}
          </article>
        )}
      </main>
    </>
  );
}

// ── Buscar ────────────────────────────────────────────────────
function SearchScreen({ initial }) {
  const posts = window.BLOG_POSTS || [];
  const [q, setQ] = useState(initial || '');
  const inputRef = useRef(null);

  useEffect(() => { setQ(initial || ''); }, [initial]);
  useEffect(() => { if (!initial) inputRef.current?.focus(); }, []);

  const tags = useMemo(() => {
    const map = {};
    posts.forEach(p => (p.tags || []).forEach(t => { map[t] = (map[t] || 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    if (term.startsWith('#')) {
      const t = term.slice(1);
      return posts.filter(p => (p.tags || []).some(x => x.toLowerCase() === t));
    }
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const nt = norm(term);
    return posts.filter(p =>
      norm(p.title).includes(nt) || norm(p.excerpt).includes(nt) ||
      (p.tags || []).some(t => norm(t).includes(nt)) || norm(p.category_label).includes(nt)
    );
  }, [q, posts]);

  return (
    <>
      <TopBar title="Buscar" />
      <main className="m-main" id="contenido">
        <form className="m-search" role="search" onSubmit={e => { e.preventDefault(); inputRef.current?.blur(); }}>
          <Icon d={I.search} size={18} />
          <input ref={inputRef} type="search" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Título, tema o #tag" aria-label="Buscar en el blog" enterKeyHint="search" />
          {q && <button type="button" className="m-iconbtn sm" onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="Borrar búsqueda"><Icon d={I.x} size={16} /></button>}
        </form>

        {!q.trim() ? (
          <>
            {tags.length > 0 && <>
              <h2 className="m-section-title">Tags</h2>
              <div className="m-tagcloud">
                {tags.map(([t, n]) => (
                  <button key={t} className="m-tag big" onClick={() => setQ('#' + t)}>#{t} <small>{n}</small></button>
                ))}
              </div>
            </>}
            <h2 className="m-section-title" style={{ marginTop: tags.length ? 28 : 0 }}>Recientes</h2>
            <div className="m-list">{posts.slice(0, 4).map(p => <PostCard key={p.id} p={p} />)}</div>
          </>
        ) : results.length === 0 ? (
          <EmptyState title={`Sin resultados para “${q}”`}>Prueba con otra palabra o toca un tag.</EmptyState>
        ) : (
          <>
            <div className="m-result-count" aria-live="polite">{results.length} resultado{results.length !== 1 ? 's' : ''}</div>
            <div className="m-list">{results.map(p => <PostCard key={p.id} p={p} />)}</div>
          </>
        )}
      </main>
    </>
  );
}

// ── Sobre mí (+ personalización y terminal) ───────────────────
function AboutScreen({ tweaks, setTweak }) {
  const accents = [['neon-green', '#39ff14', 'Verde'], ['cyan', '#00f0ff', 'Cian'], ['magenta', '#ff00d4', 'Magenta'], ['amber', '#ffb800', 'Ámbar']];
  return (
    <>
      <TopBar title="Sobre mí" />
      <main className="m-main m-embed" id="contenido">
        <window.AboutApp />
        <section className="m-panel">
          <h2 className="m-section-title">Color de acento</h2>
          <div className="m-swatches" role="radiogroup" aria-label="Color de acento">
            {accents.map(([v, c, l]) => (
              <button key={v} role="radio" aria-checked={tweaks.accent === v} aria-label={l}
                className={`m-swatch${tweaks.accent === v ? ' active' : ''}`} style={{ '--sw': c }}
                onClick={() => setTweak('accent', v)} />
            ))}
          </div>
        </section>
        <a className="m-row-link" href="#/terminal">
          <Icon d={I.term} /><span>Abrir la terminal<small>el easter egg de la versión escritorio</small></span><Icon d={I.chev} size={18} />
        </a>
      </main>
    </>
  );
}

function ContactScreen() {
  return (
    <>
      <TopBar title="Contacto" />
      <main className="m-main m-embed" id="contenido"><window.MailApp /></main>
    </>
  );
}

function TerminalScreen() {
  return (
    <>
      <TopBar title="Terminal" onBack={() => (history.length > 1 ? history.back() : go('sobre-mi'))} />
      <main className="m-main m-embed m-term" id="contenido"><window.TerminalApp autoFocus={false} /></main>
    </>
  );
}

// ── Toast ─────────────────────────────────────────────────────
function Toast() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let t;
    window.__toast = (m) => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(''), 2200); };
    return () => { delete window.__toast; clearTimeout(t); };
  }, []);
  return <div className={`m-toast${msg ? ' show' : ''}`} role="status" aria-live="polite">{msg}</div>;
}

// ── Raíz móvil ────────────────────────────────────────────────
function Mobile({ tweaks, setTweak }) {
  const scrollMemo = useRef({});
  const keyRef = useRef('');
  // Guarda la posición de scroll de la pantalla que se abandona…
  const route = useRoute(() => { scrollMemo.current[keyRef.current] = window.scrollY; });
  const key = route.name + ':' + (route.id || route.cat || '') + ':' + (route.q || '');

  // …y la restaura al volver al listado; el resto de pantallas empiezan arriba
  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    const y = route.name === 'home' ? scrollMemo.current[key] || 0 : 0;
    window.scrollTo(0, y);
  }, [key]);

  const activeTab = route.name === 'post' || route.name === 'terminal' ? null : route.name;

  let screen;
  if (route.name === 'post')          screen = <PostScreen id={route.id} />;
  else if (route.name === 'search')   screen = <SearchScreen initial={route.q} />;
  else if (route.name === 'contact')  screen = <ContactScreen />;
  else if (route.name === 'about')    screen = <AboutScreen tweaks={tweaks} setTweak={setTweak} />;
  else if (route.name === 'terminal') screen = <TerminalScreen />;
  else                                screen = <HomeScreen cat={route.cat} />;

  return (
    <div className="m-root">
      {screen}
      <TabBar active={activeTab} />
      <Toast />
    </div>
  );
}

window.Mobile = Mobile;
})();
