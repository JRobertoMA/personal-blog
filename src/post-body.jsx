// ─── Cuerpo de un post renderizado ─────────────────────────────
// Compartido por el escritorio (ventanas de lectura) y el móvil.
//   body        Markdown del post
//   className   clase de la superficie: 'post-body' (escritorio) o 'm-prose' (móvil)
//   onOpenImage (src, alt, img) → abre la imagen; sin él, las imágenes no son clicables
//   tocOpen     índice desplegado de inicio
// El índice aparece si el post tiene 3 o más encabezados.
(function() {
const { useMemo, useRef, useEffect } = React;

const TOC_MIN = 3;

function PostBody({ body, className = 'post-body', onOpenImage, tocOpen = true }) {
  const ref = useRef(null);
  const { html, toc } = useMemo(() => {
    const env = {};
    const html = window.renderMarkdown(body, env);
    return { html, toc: env.toc || [] };
  }, [body]);

  useEffect(() => { window.highlightCode(ref.current); }, [html]);

  return (
    <>
      {toc.length >= TOC_MIN && (
        <details className="md-toc" open={tocOpen}>
          <summary className="md-toc-title">Índice</summary>
          <ol>
            {toc.map(h => (
              <li key={h.id} className={`lvl-${h.level}`}>
                <button type="button" onClick={() => window.scrollToMarkdownAnchor(ref.current, h.id)}>{h.text}</button>
              </li>
            ))}
          </ol>
        </details>
      )}
      <div
        ref={ref}
        className={`${className} md${onOpenImage ? ' md-zoom' : ''}`}
        onClick={e => window.handleMarkdownClick(e, { onImage: onOpenImage })}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

window.PostBody = PostBody;
})();
