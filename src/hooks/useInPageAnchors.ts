import { type RefObject, useEffect } from 'react';

/** decodeURIComponent that falls back to the raw value: a malformed escape (e.g. `#100%`) otherwise throws a
 *  URIError, and an exception in this effect would unmount the tree up to the nearest error boundary. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Turns an article's same-page anchor links (its own cross-references, e.g. `#weasyprint-configuration`)
 * into in-page scroll targets, and scrolls to the fragment the page URL arrived with once the fetched
 * article is in the DOM.
 *
 * The `href` is removed - so hovering cannot leak the embedded `?feature=...&embedded=true&scope=...` URL
 * into the browser preview - and replaced with a keyboard-operable `role="link"` carrying the fragment as
 * its tooltip. Re-runs whenever `dep` changes (pass the loaded HTML), since the article is fetched
 * asynchronously and the browser cannot scroll to an element that does not exist yet.
 */
export function useInPageAnchors(ref: RefObject<HTMLElement | null>, dep: unknown): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const doc = root.ownerDocument;

    root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
      const href = a.getAttribute('href') ?? '';
      const id = safeDecode(href.slice(1));
      a.removeAttribute('href');
      a.title = href;
      a.setAttribute('role', 'link');
      a.tabIndex = 0;
      a.classList.add('docs-anchor');
      const scrollToTarget = () => {
        if (id) doc.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      };
      a.addEventListener('click', scrollToTarget);
      a.addEventListener('keydown', (e) => {
        // Enter only, as on a native link: Space keeps scrolling the page.
        if (e.key === 'Enter') {
          e.preventDefault();
          scrollToTarget();
        }
      });
    });

    // A cross-document link may have arrived here with a fragment in the page URL (e.g.
    // ?feature=configuration#bulk-processing-api-key). The browser cannot scroll to it on its own - the
    // target only exists once this fetched article is in the DOM - so bring it into view here.
    const hash = doc.defaultView?.location.hash.slice(1);
    if (hash) {
      doc.getElementById(safeDecode(hash))?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ref, dep]);
}
