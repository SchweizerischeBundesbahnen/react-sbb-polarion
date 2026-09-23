// Navigation helpers for the documentation site. The whole admin app is a single bundle whose page is
// chosen from a `?feature=<id>` query parameter, so every in-app link - the sidebar, prev/next, breadcrumb
// and search results - is one of these, and a cross-document link inside an article (`configuration.html`)
// is turned into one by the interceptor.

/**
 * A relative link to another generated documentation article, e.g. `configuration.html` or
 * `upgrade.html#weasyprint-configuration`. The extension's build rewrites the markdown `.md` links to these
 * `.html` targets; the basename equals the feature id of the page that renders that article.
 */
const DOC_LINK = /^([\w-]+)\.html(#.*)?$/;

/**
 * Builds an in-app URL that selects a feature via `?feature=`, preserving the other params Polarion set
 * (`embedded`, `scope`) and carrying an optional fragment across.
 */
export function featureHref(
  feature: string,
  hash = '',
  location: { pathname: string; search: string } = window.location,
): string {
  const params = new URLSearchParams(location.search);
  params.set('feature', feature);
  return `${location.pathname}?${params.toString()}${hash}`;
}

/**
 * Maps a cross-document help-article link to the in-app URL that shows it, or null when the href is not such
 * a link (external, an in-page anchor, a non-doc relative path) and should be left alone. `configuration.html#x`
 * becomes `?feature=configuration#x`, preserving the other params and carrying the fragment across.
 */
export function docLinkTarget(
  href: string | null,
  location: { pathname: string; search: string } = window.location,
): string | null {
  const match = href ? DOC_LINK.exec(href) : null;
  if (!match) {
    return null;
  }
  const [, feature, hash = ''] = match;
  return featureHref(feature, hash, location);
}

/** The feature id and fragment a cross-document help-article href points at, or null when it is not one. */
export function parseDocLink(href: string | null): { feature: string; hash: string } | null {
  const match = href ? DOC_LINK.exec(href) : null;
  if (!match) {
    return null;
  }
  const [, feature, hash = ''] = match;
  return { feature, hash };
}
