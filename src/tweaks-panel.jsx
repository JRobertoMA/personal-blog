// ─── Tweaks Panel ──────────────────────────────────────────────
(function() {
const { useState, useCallback } = React;

function useTweaks(defaults) {
  const key = 'jros-tweaks';
  const load = () => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
    catch { return { ...defaults }; }
  };
  const [values, setValues] = useState(load);

  const setTweak = useCallback((k, v) => {
    setValues(prev => {
      const next = { ...prev, [k]: v };
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, []);

  return [values, setTweak];
}

function TweaksPanel({ title, children }) {
  return (
    <div className="tweaks-panel">
      <div className="tweaks-title">{title}</div>
      <div className="tweaks-body">{children}</div>
    </div>
  );
}

function TweakSection({ label, children }) {
  return (
    <div className="tweak-section">
      <div className="tweak-section-label">{label}</div>
      {children}
    </div>
  );
}

function TweakRadio({ value, onChange, options }) {
  return (
    <div className="tweak-radio">
      {options.map(opt => (
        <label key={opt.value}>
          <input
            type="radio"
            name={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="tweak-toggle">
      <span>{label}</span>
      <div
        className={`tweak-toggle-switch${value ? ' on' : ''}`}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
      />
    </div>
  );
}

// Ajustes en vivo para cualquier componente. Las ventanas del escritorio
// guardan su contenido al abrirse, así que no pueden recibirlos por props.
const TweaksContext = React.createContext({ tweaks: {}, setTweak: () => {} });
const useTweakContext = () => React.useContext(TweaksContext);

// Fondos de escritorio (los usa el escritorio y las miniaturas de Ajustes)
const WALLPAPERS = [
  { id: 'neon',   label: 'Neón',   style: {} },
  { id: 'matrix', label: 'Matrix', style: { backgroundImage: 'radial-gradient(ellipse at 50% 50%, rgba(var(--neon-rgb),0.15), transparent 60%), linear-gradient(180deg, #000, #050605)' } },
  { id: 'sunset', label: 'Sunset', style: { backgroundImage: 'radial-gradient(ellipse at 50% 80%, rgba(255,100,80,0.25), transparent 60%), radial-gradient(ellipse at 50% 30%, rgba(120,40,180,0.2), transparent 60%), linear-gradient(180deg, #1a0820, #0a0410)' } },
];
const wallpaperStyle = (id) => (WALLPAPERS.find(w => w.id === id) || WALLPAPERS[0]).style;

// Colores de acento: [neón principal, neón secundario]
const ACCENTS = [
  { id: 'neon-green', label: 'Verde',   colors: ['#39ff14', '#00f0ff'] },
  { id: 'cyan',       label: 'Cian',    colors: ['#00f0ff', '#39ff14'] },
  { id: 'magenta',    label: 'Magenta', colors: ['#ff00d4', '#00f0ff'] },
  { id: 'amber',      label: 'Ámbar',   colors: ['#ffb800', '#ff00d4'] },
];

window.TweaksContext   = TweaksContext;
window.useTweakContext = useTweakContext;
window.WALLPAPERS      = WALLPAPERS;
window.wallpaperStyle  = wallpaperStyle;
window.ACCENTS         = ACCENTS;
window.useTweaks    = useTweaks;
window.TweaksPanel  = TweaksPanel;
window.TweakSection = TweakSection;
window.TweakRadio   = TweakRadio;
window.TweakToggle  = TweakToggle;
})();
