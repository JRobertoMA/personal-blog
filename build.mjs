// Compila src/*.jsx → assets/app.js y assets/admin.js (minificados, React de producción).
// Uso: npm install && npm run build   (o npm run watch mientras desarrollas)
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: { app: 'src/main.jsx', admin: 'src/admin.jsx' },
  outdir: 'assets',
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  target: 'es2020',
  jsx: 'transform',
  loader: { '.jsx': 'jsx' },
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
