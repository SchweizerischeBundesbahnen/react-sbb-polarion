import { useDocs } from '../../docs/DocsContext';

interface PrevNextProps {
  /** Feature id of the current article. */
  activeId: string;
}

/** The previous/next article links, following the manifest's reading order. */
export default function PrevNext({ activeId }: Readonly<PrevNextProps>) {
  const { neighbours, featureHref } = useDocs();
  const { prev, next } = neighbours(activeId);
  if (!prev && !next) {
    return null;
  }
  return (
    <nav className="docs-prevnext" aria-label="Previous and next article">
      {prev ? (
        <a className="docs-prevnext-link docs-prevnext-prev" href={featureHref(prev.id)}>
          <span className="docs-prevnext-dir">&larr; Previous</span>
          <span className="docs-prevnext-title">{prev.title}</span>
        </a>
      ) : (
        <span />
      )}
      {next && (
        <a className="docs-prevnext-link docs-prevnext-next" href={featureHref(next.id)}>
          <span className="docs-prevnext-dir">Next &rarr;</span>
          <span className="docs-prevnext-title">{next.title}</span>
        </a>
      )}
    </nav>
  );
}
