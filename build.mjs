// Compila src/ → assets/app.js, assets/admin.js y assets/hljs.js (resaltado de sintaxis,
// se descarga bajo demanda). Minificados, React de producción.
// Uso: npm install && npm run build   (o npm run watch mientras desarrollas)
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: { app: 'src/main.jsx', admin: 'src/admin.jsx', hljs: 'src/highlight.js' },
  outdir: 'assets',
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  target: 'es2020',
  jsx: 'transform',
  loader: { '.jsx': 'jsx' },
  // markdown-it solo necesita decodificar unas pocas entidades (ver src/shims/entities.js)
  alias: { entities: './src/shims/entities.js' },
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  legalComments: 'none',
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
