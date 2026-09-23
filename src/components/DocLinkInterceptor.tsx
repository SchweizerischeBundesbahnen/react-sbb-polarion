import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { useDocs } from '../docs/DocsContext';
import { parseDocLink } from '../services/docsNav';

/**
 * Wraps a subtree in one delegated click handler that turns clicks on the articles' relative links into the
 * right navigation. The build leaves these links relative (no rewriting at build time):
 *   - a cross-document link to another article - `<feature>.html` or a `.md` source mapped through
 *     {@link DocsConfig.mdLinkMap} - becomes in-app feature navigation (`?feature=`); without this the
 *     browser would resolve it against the app URL and 404.
 *   - any other relative link (e.g. `docs/openapi.json`) points at a file in the source repo and opens at
 *     {@link DocsConfig.sourceBaseUrl} in a new tab.
 *
 * A modified click (new tab/window) is left to the browser. The extension may pass `onDocLinkNavigate`
 * through the {@link DocsProvider} to sync Polarion's admin shell; when it returns false (or is absent) the
 * interceptor falls back to a plain in-frame navigation via `featureHref`.
 */
export default function DocLinkInterceptor({ children }: Readonly<{ children: ReactNode }>) {
  const { featureHref, onDocLinkNavigate, mdLinkMap, sourceBaseUrl } = useDocs();

  const handleClick = useCallback(
    (event: MouseEvent) => {
      // let the user open a link in a new tab/window as usual
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement).closest('a');
      const href = anchor?.getAttribute('href') ?? '';
      // Leave it to the browser when it is: empty, an in-page anchor (handled elsewhere), a scheme URL
      // (http:, mailto:, ...), a protocol-relative URL, or a site-absolute path - the latter is the app's own
      // navigation (the sidebar/prev-next/breadcrumb `?feature=` links, whose pathname is absolute), which must
      // not be mistaken for a repo-relative content link below.
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('/') ||
        href.startsWith('//') ||
        /^[a-z][a-z0-9+.-]*:/i.test(href)
      ) {
        return;
      }

      const hashAt = href.indexOf('#');
      const path = hashAt < 0 ? href : href.slice(0, hashAt);
      const hash = hashAt < 0 ? '' : href.slice(hashAt);

      // A cross-document article link: `<feature>.html` or a mapped `.md` source.
      const docLink = parseDocLink(href);
      const feature = docLink ? docLink.feature : mdLinkMap[path];
      if (feature) {
        const targetHash = docLink ? docLink.hash : hash;
        event.preventDefault();
        if (!onDocLinkNavigate?.(feature, targetHash)) {
          window.location.assign(featureHref(feature, targetHash));
        }
        return;
      }

      // Any other relative link points at a file in the source repo (e.g. docs/openapi.json).
      if (sourceBaseUrl) {
        event.preventDefault();
        window.open(`${sourceBaseUrl}/${href}`, '_blank', 'noopener');
      }
    },
    [featureHref, mdLinkMap, onDocLinkNavigate, sourceBaseUrl],
  );

  // A delegated click listener rather than an onClick on the wrapper: the wrapper is not itself an
  // interactive control (the real controls are the native <a> links it delegates for, which stay
  // keyboard-accessible), so attaching the listener imperatively keeps the div free of interactive roles.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.addEventListener('click', handleClick);
    return () => node.removeEventListener('click', handleClick);
  }, [handleClick]);

  return <div ref={ref}>{children}</div>;
}
