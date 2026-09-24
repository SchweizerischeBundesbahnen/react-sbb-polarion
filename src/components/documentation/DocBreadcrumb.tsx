import { useDocs } from '../../docs/DocsContext';

interface DocBreadcrumbProps {
  /** Feature id of the current article. */
  activeId: string;
}

/**
 * In-content breadcrumb "Documentation › <article>" shown at the top of every documentation page.
 *
 * Polarion's own left-menu highlight and header breadcrumb live in the shell (top) window, which in-frame
 * `?feature=` navigation does not touch: `createAdminNav` switches the shell only when a link crosses to
 * another admin node, and every article shares the one documentation node. This breadcrumb makes the "you
 * are in Documentation › <article>" context explicit inside the app's own frame, whatever the shell shows.
 * The root links to the section landing (the first article by default).
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
