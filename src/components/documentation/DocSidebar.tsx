import { useDocs } from '../../docs/DocsContext';

interface DocSidebarProps {
  /** Feature id of the article currently shown, highlighted in the list. */
  activeId: string;
}

/**
 * The documentation navigation: the manifest's articles as a single list of links, in reading order. Each
 * link is a real in-app `?feature=` URL built by `featureHref` (so middle-click / open-in-new-tab work), and
 * a plain left click navigates through it as a normal link - the {@link DocLinkInterceptor} deliberately
 * leaves these alone (it only rewrites the relative `.html`/`.md` cross-links inside article bodies).
 */
export default function DocSidebar({ activeId }: Readonly<DocSidebarProps>) {
  const { docs, featureHref } = useDocs();
  return (
    <nav className="docs-nav" aria-label="Documentation">
      <ul>
        {docs.map((doc) => (
          <li key={doc.id}>
            <a
              href={featureHref(doc.id)}
              className={doc.id === activeId ? 'docs-nav-link docs-nav-link-active' : 'docs-nav-link'}
              aria-current={doc.id === activeId ? 'page' : undefined}
            >
              {doc.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
