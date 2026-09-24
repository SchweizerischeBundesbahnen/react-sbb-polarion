import { useDocs } from '../../docs/DocsContext';

interface DocBreadcrumbProps {
  /** Feature id of the current article. */
  activeId: string;
}

/**
 * In-content breadcrumb "Documentation › <article>" shown at the top of every documentation page.
 *
 * Polarion's own left-menu highlight and header breadcrumb live in the shell (top) window and are not
 * synced by content-internal links. This is the robust, self-contained alternative: it makes the "you are
 * in Documentation" context explicit inside the app's own frame. The root links to the section landing (the
 * first article by default).
 */
export default function DocBreadcrumb({ activeId }: Readonly<DocBreadcrumbProps>) {
  const { byId, featureHref, breadcrumbRootLabel, breadcrumbLandingId } = useDocs();
  const title = byId[activeId]?.title ?? activeId;
  return (
    <nav className="docs-breadcrumb" aria-label="Breadcrumb">
      <a className="docs-breadcrumb-root" href={featureHref(breadcrumbLandingId)}>
        {breadcrumbRootLabel}
      </a>
      <span className="docs-breadcrumb-sep" aria-hidden="true">
        ›
      </span>
      <span className="docs-breadcrumb-current" aria-current="page">
        {title}
      </span>
    </nav>
  );
}
