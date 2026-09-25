// Punto de entrada del sitio público. El orden de import importa:
// cada archivo registra sus componentes en window.*
import './globals.js';
import './markdown.js';
import './notes.js';
import './tweaks-panel.jsx';
import './window-manager.jsx';
import './apps.jsx';
import './desktop.jsx';
import './mobile.jsx';

const { useState, useEffect } = React;

const TWEAK_DEFAULTS = {
  wallpaper: 'neon',
  soundsOn: true,
  showBoot: true,
  accent: 'neon-green',
};

// Móvil = pantalla estrecha o dispositivo táctil (las ventanas solo se
// arrastran con ratón, así que las tablets también usan la versión móvil).
const MOBILE_QUERY = '(max-width: 820px), (pointer: coarse)';

function useIsMobile() {
  const mq = window.matchMedia(MOBILE_QUERY);
  const [mobile, setMobile] = useState(mq.matches);
  useEffect(() => {
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler));
  }, []);
  return mobile;
}

function loadData() {
  window.BLOG_POSTS = [];
  window.BLOG_CATEGORIES = [];
  window.BLOG_ABOUT = {};
  const getJson = (url) => fetch(url).then(r => r.json());
  return Promise.all([
    getJson('api/posts').then(res => {
      if (res.ok && res.data) {
        window.BLOG_POSTS      = res.data.posts      || [];
        window.BLOG_CATEGORIES = res.data.categories || [];
      }
    }).catch(() => console.warn('jrobertoma: no se pudo contactar con api/posts')),
    getJson('api/about').then(res => {
      if (res.ok && res.data) window.BLOG_ABOUT = res.data;
    }).catch(() => console.warn('jrobertoma: no se pudo contactar con api/about')),
  ]);
}

// Iniciales del autor: las del "Sobre mí" o, si no hay, las del nombre
window.aboutInitials = () => {
  const a = window.BLOG_ABOUT || {};
  if (a.initials) return a.initials;
  return (a.name || 'jr').split(/\s+/).filter(w => /^\p{L}/u.test(w)).map(w => w[0]).join('').slice(0, 2).toUpperCase();
};
const dataReady = loadData();

function Root() {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [ready, setReady] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    dataReady.then(() => {
      setReady(true);
      const el = document.getElementById('app-loading');
      if (el) { el.classList.add('hidden'); setTimeout(() => el.remove(), 400); }
    });
  }, []);

  useEffect(() => {
    const accent = window.ACCENTS.find(a => a.id === tweaks.accent) || window.ACCENTS[0];
    const [neon, neon2] = accent.colors;
    const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ');
    const root = document.documentElement.style;
    root.setProperty('--neon', neon);
    root.setProperty('--neon-2', neon2);
    root.setProperty('--neon-rgb', rgb(neon));      // para rgba(var(--neon-rgb), .x)
    root.setProperty('--neon-2-rgb', rgb(neon2));
  }, [tweaks.accent]);

  useEffect(() => {
    document.documentElement.classList.toggle('is-mobile', isMobile);
  }, [isMobile]);

  if (!ready) return null;

  return (
    <window.TweaksContext.Provider value={{ tweaks, setTweak }}>
      {isMobile
        ? <window.Mobile tweaks={tweaks} setTweak={setTweak} />
        : <window.Desktop tweaks={tweaks} setTweak={setTweak} />}
    </window.TweaksContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
