import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useDocs } from '../docs/DocsContext';
import { useInPageAnchors } from '../hooks/useInPageAnchors';
import './markdown.css';

interface DocArticleProps {
  /** HTML basename without extension, e.g. `configuration`. Equals this page's feature id and the `.html`
   *  target the build's link rewriting points cross-doc links at, so those links resolve to a feature. */
  name: string;
  /** The markdown source file, linked in the "not generated" fallback (e.g. `CONFIGURATION.md`). */
  source?: string;
}

/**
 * Renders a build-generated help article (CONFIGURATION.md, UPGRADE.md, ...) as bare content - the
 * surrounding frame (title, sidebar, on-this-page, prev/next) is provided by {@link DocLayout}.
 *
 * The article is a static resource served next to the app bundle; it is fetched from the URL the
 * {@link DocsProvider} resolves for `name`. Cross-document links between articles are handled by the
 * {@link DocLinkInterceptor}; only same-page anchors are handled here (see {@link useInPageAnchors}).
 */
export default function DocArticle({ name, source }: Readonly<DocArticleProps>) {
  const { articleHtmlUrl, sourceBaseUrl } = useDocs();
  const [html, setHtml] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(articleHtmlUrl(name), { cache: 'no-cache' })
      .then(async (response) => {
        const article = response.ok ? (await response.text()).trim() : '';
        if (cancelled) return;
        if (article) {
          setHtml(article);
        } else {
          setMissing(true);
        }
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [name, articleHtmlUrl]);

  useInPageAnchors(articleRef, html);

  let content: ReactNode;
  if (missing) {
    const sourceHref = sourceBaseUrl && source ? `${sourceBaseUrl}/${source}` : null;
    content = (
      <p>
        This article has not been generated during build.
        {sourceHref ? (
          <>
            {' '}
            Please check{' '}
            <a href={sourceHref} target="_blank" rel="noreferrer">
              the online documentation
            </a>
            .
          </>
        ) : null}
      </p>
    );
  } else if (html === null) {
    content = <p>Loading...</p>;
  } else {
    // Trusted, build-generated HTML from the extension's markdown sources.
    content = <article ref={articleRef} className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return content;
}
