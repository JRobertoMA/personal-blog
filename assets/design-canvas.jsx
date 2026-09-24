// ─── Design Canvas ─────────────────────────────────────────────
// Pan/zoom viewport that wraps artboards side-by-side
(function() {
const { useState, useRef, useEffect, useCallback, Children } = React;

function DesignCanvas({ children }) {
  const [pos, setPos] = useState({ x: 60, y: 60 });
  const [zoom, setZoom] = useState(0.5);
  const [panning, setPanning] = useState(false);
  const rootRef = useRef(null);
  const panRef  = useRef(null);

  const clampZoom = z => Math.max(0.1, Math.min(2, z));

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.001;
        setZoom(z => {
          const next = clampZoom(z + delta * z);
          const rect = el.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          setPos(p => ({
            x: mx - (mx - p.x) * (next / z),
            y: my - (my - p.y) * (next / z),
          }));
          return next;
        });
      } else {
        setPos(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onMouseDown = (e) => {
    if (e.button !== 1 && !e.altKey) return;
    e.preventDefault();
    setPanning(true);
    panRef.current = { sx: e.clientX - pos.x, sy: e.clientY - pos.y };
  };
  const onMouseMove = useCallback((e) => {
    if (!panning || !panRef.current) return;
    setPos({ x: e.clientX - panRef.current.sx, y: e.clientY - panRef.current.sy });
  }, [panning]);
  const onMouseUp = () => setPanning(false);

  const zoomIn  = () => setZoom(z => clampZoom(z + 0.1));
  const zoomOut = () => setZoom(z => clampZoom(z - 0.1));
  const zoomFit = () => { setZoom(0.5); setPos({ x: 60, y: 60 }); };

  return (
    <div
      className={`dc-root${panning ? ' panning' : ''}`}
      ref={rootRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
        className="dc-viewport"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }}
      >
        {children}
      </div>
      <div className="dc-zoom">
        <button onClick={zoomOut} title="Zoom out">−</button>
        <span className="pct">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} title="Zoom in">+</button>
        <button onClick={zoomFit} title="Fit" style={{ fontSize: 11, width: 36 }}>Fit</button>
      </div>
    </div>
  );
}

function DCSection({ id, title, subtitle, children }) {
  return (
    <div className="dc-section" id={id}>
      <div className="dc-section-header">
        <div className="dc-section-title">{title}</div>
        {subtitle && <div className="dc-section-subtitle">{subtitle}</div>}
      </div>
      <div className="dc-artboards">{children}</div>
    </div>
  );
}

function DCArtboard({ id, label, width, height, children }) {
  return (
    <div className="dc-artboard" id={id}>
      <div className="dc-artboard-label">{label}</div>
      <div className="dc-artboard-frame" style={{ width, height }}>
        {children}
      </div>
    </div>
  );
}

window.DesignCanvas = DesignCanvas;
window.DCSection    = DCSection;
window.DCArtboard   = DCArtboard;
})();
