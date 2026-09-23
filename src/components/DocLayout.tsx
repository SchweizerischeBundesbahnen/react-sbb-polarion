import { type ReactNode, useRef } from 'react';
import DocBreadcrumb from './DocBreadcrumb';
import DocSearch from './DocSearch';
import DocSidebar from './DocSidebar';
import OnThisPage from './OnThisPage';
import PrevNext from './PrevNext';
import './docs.css';

interface DocLayoutProps {
  /** Feature id of the article being shown; drives the sidebar highlight, breadcrumb and prev/next. */
  activeId: string;
  /** The article body, typically a <DocArticle />. */
  children: ReactNode;
}

/**
 * The documentation-site frame shared by every article page: a left sidebar carrying search, the article
 * navigation and - below a divider - the "on this page" table of contents, with the article and its
 * prev/next in the remaining column. The article renders its own h1 (from the markdown), so this frame adds
 * no title of its own. Wrap the app in a {@link DocsProvider} so these parts can read the manifest.
 */
export default function DocLayout({ activeId, children }: Readonly<DocLayoutProps>) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <div className="docs">
      <DocBreadcrumb activeId={activeId} />
      <aside className="docs-sidebar">
        <DocSearch />
        <DocSidebar activeId={activeId} />
        <OnThisPage contentRef={contentRef} />
      </aside>
      <main className="docs-main">
        <div className="docs-content" ref={contentRef}>
          {children}
        </div>
        <PrevNext activeId={activeId} />
      </main>
    </div>
  );
}
