// Expone React como global: los componentes se escribieron para la versión UMD
// y comparten componentes vía window.*. Debe importarse antes que el resto.
import React from 'react';
import * as ReactDOMClient from 'react-dom/client';

window.React = React;
window.ReactDOM = ReactDOMClient;
