// Punto de entrada del sitio público. El orden de import importa:
// cada archivo registra sus componentes en window.*
import './globals.js';
import './markdown.js';
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
  return fetch('api/posts')
    .then(r => r.json())
    .then(res => {
      if (res.ok && res.data) {
        window.BLOG_POSTS      = res.data.posts      || [];
        window.BLOG_CATEGORIES = res.data.categories || [];
      }
    })
    .catch(() => console.warn('jrobertoma: no se pudo contactar con api/posts'));
}
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
    const map = {
      'neon-green': ['#39ff14', '#00f0ff'],
      'cyan':       ['#00f0ff', '#39ff14'],
      'magenta':    ['#ff00d4', '#00f0ff'],
      'amber':      ['#ffb800', '#ff00d4'],
    };
    const [neon, neon2] = map[tweaks.accent] || map['neon-green'];
    document.documentElement.style.setProperty('--neon', neon);
    document.documentElement.style.setProperty('--neon-2', neon2);
  }, [tweaks.accent]);

  useEffect(() => {
    document.documentElement.classList.toggle('is-mobile', isMobile);
  }, [isMobile]);

  if (!ready) return null;

  return isMobile
    ? <window.Mobile tweaks={tweaks} setTweak={setTweak} />
    : <window.Desktop tweaks={tweaks} setTweak={setTweak} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
