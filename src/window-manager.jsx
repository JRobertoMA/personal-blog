// ─── Window Manager ────────────────────────────────────────────
(function() {
const { useState, useRef, useCallback, useEffect } = React;

function useWindowManager() {
  const [windows, setWindows]   = useState([]);
  const [focused, setFocused]   = useState(null);
  const zCounter = useRef(100);

  const openWindow = useCallback((config) => {
    const id = config.id || ('win-' + Date.now());
    setWindows(ws => {
      // Ya abierta: se restaura (si estaba minimizada) y se trae al frente
      if (ws.some(w => w.id === id)) {
        return ws.map(w => w.id === id ? { ...w, minimized: false, z: ++zCounter.current } : w);
      }
      const count = ws.length;
      const defaultW = config.width  || 640;
      const defaultH = config.height || 420;
      const offset   = (count % 6) * 24;
      return [...ws, {
        id,
        title:     config.title || id,
        icon:      config.icon  || '📄',
        content:   config.content,
        x:         Math.max(20, (window.innerWidth  - defaultW) / 2 + offset - 100),
        y:         Math.max(20, (window.innerHeight - defaultH) / 2 + offset - 60),
        width:     defaultW,
        height:    defaultH,
        minimized: false,
        maximized: false,
        z:         ++zCounter.current,
      }];
    });
    setFocused(id);
  }, []);

  const closeWindow = useCallback((id) => {
    setWindows(ws => ws.filter(w => w.id !== id));
    setFocused(f => f === id ? null : f);
  }, []);

  // Enfocar también restaura: una ventana minimizada no puede estar al frente
  const focusWindow = useCallback((id) => {
    setWindows(ws => ws.map(w => w.id === id ? { ...w, minimized: false, z: ++zCounter.current } : w));
    setFocused(id);
  }, []);

  const toggleMinimize = useCallback((id) => {
    setWindows(ws => ws.map(w => w.id === id ? { ...w, minimized: !w.minimized } : w));
  }, []);

  const toggleMaximize = useCallback((id) => {
    setWindows(ws => ws.map(w => w.id === id ? { ...w, maximized: !w.maximized } : w));
  }, []);

  const moveWindow = useCallback((id, x, y) => {
    setWindows(ws => ws.map(w => w.id === id ? { ...w, x, y } : w));
  }, []);

  const resizeWindow = useCallback((id, width, height) => {
    setWindows(ws => ws.map(w => w.id === id ? {
      ...w,
      width:  Math.max(280, width),
      height: Math.max(180, height),
    } : w));
  }, []);

  const updateWindowContent = useCallback((id, content) => {
    setWindows(ws => ws.map(w => w.id === id ? { ...w, content } : w));
  }, []);

  const centerWindow = useCallback((id) => {
    setWindows(ws => ws.map(w => {
      if (w.id !== id) return w;
      const x = Math.max(0, Math.round((window.innerWidth  - w.width)  / 2));
      const y = Math.max(0, Math.round((window.innerHeight - 40 - w.height) / 2));
      return { ...w, x, y, minimized: false, z: ++zCounter.current };
    }));
    setFocused(id);
  }, []);

  return { windows, focused, openWindow, closeWindow, focusWindow, toggleMinimize, toggleMaximize, moveWindow, resizeWindow, updateWindowContent, centerWindow };
}

function Window({ win, focused, onClose, onFocus, onMinimize, onMaximize, onMove, onResize, playSound }) {
  const titleRef = useRef(null);

  // Drag with RAF throttle
  const onTitleMouseDown = (e) => {
    if (e.target.closest('.win-btn')) return;
    if (win.maximized) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    const startX = e.clientX - win.x;
    const startY = e.clientY - win.y;
    let rafId = null;
    const handleMove = (mv) => {
      const x = mv.clientX - startX;
      const y = Math.max(0, mv.clientY - startY);
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => onMove(x, y));
    };
    const onUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', onUp);
  };

  // Resize
  const onResizeMouseDown = (e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startW = win.width, startH = win.height;
    const onMv = (mv) => onResize(startW + mv.clientX - startX, startH + mv.clientY - startY);
    const onUp = () => { document.removeEventListener('mousemove', onMv); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMv);
    document.addEventListener('mouseup', onUp);
  };

  if (win.minimized) return null;

  const style = win.maximized
    ? { position: 'absolute', left: 0, top: 0, width: '100%', height: 'calc(100% - 40px)', zIndex: win.z }
    : { position: 'absolute', left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.z };

  return (
    <div
      className={`window${focused ? ' focused' : ''}${win.maximized ? ' maximized' : ''}`}
      style={style}
      onMouseDown={onFocus}
    >
      <div className="win-titlebar" onMouseDown={onTitleMouseDown} onDoubleClick={onMaximize} ref={titleRef}>
        <div className="win-title">
          <span className="icon">{win.icon}</span>
          <span className="text">{win.title}</span>
        </div>
        <div className="win-buttons">
          <button className="win-btn" onClick={(e) => { e.stopPropagation(); playSound?.(); onMinimize(); }} title="Minimizar">─</button>
          <button className="win-btn" onClick={(e) => { e.stopPropagation(); playSound?.(); onMaximize(); }} title="Maximizar">{win.maximized ? '❐' : '☐'}</button>
          <button className="win-btn close" onClick={(e) => { e.stopPropagation(); playSound?.(); onClose(); }} title="Cerrar">✕</button>
        </div>
      </div>
      <div className="win-body">
        {win.content}
      </div>
      {!win.maximized && (
        <div className="win-resize" onMouseDown={onResizeMouseDown} />
      )}
    </div>
  );
}

window.useWindowManager = useWindowManager;
window.Window           = Window;
})();
