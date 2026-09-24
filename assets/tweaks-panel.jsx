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

window.useTweaks    = useTweaks;
window.TweaksPanel  = TweaksPanel;
window.TweakSection = TweakSection;
window.TweakRadio   = TweakRadio;
window.TweakToggle  = TweakToggle;
})();
