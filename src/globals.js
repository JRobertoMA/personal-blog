// Expone React como global: los componentes se escribieron para la versión UMD
// y comparten componentes vía window.*. Debe importarse antes que el resto.
import React from 'react';
import * as ReactDOMClient from 'react-dom/client';

window.React = React;
window.ReactDOM = ReactDOMClient;

// Props para que un elemento clicable que no es <button> se pueda usar con el
// teclado: rol de botón, foco con Tab y activación con Enter o Espacio.
// Uso: <div {...pressable(() => abrir(), { label: 'Abrir' })}>
window.pressable = (onActivate, { label, role = 'button', pressed, current } = {}) => ({
  role,
  tabIndex: 0,
  onClick: onActivate,
  onKeyDown: (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(e); }
  },
  ...(label ? { 'aria-label': label } : {}),
  ...(pressed !== undefined ? { 'aria-pressed': !!pressed } : {}),
  ...(current ? { 'aria-current': 'true' } : {}),
});
