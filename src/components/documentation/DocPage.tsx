import type { DocEntry } from '../../docs/DocsContext';
import DocArticle from './DocArticle';
import DocLayout from './DocLayout';

/**
 * A single documentation-site article page: {@link DocArticle} fetches the generated `<id>.html`,
 * {@link DocLayout} wraps it in the sidebar / on-this-page / prev-next frame. One of these bound to each
 * manifest entry is the whole documentation section of a single-bundle admin app, so an extension builds its
 * doc features straight from the manifest (`docs.map((doc) => ({ id: doc.id, component: () => <DocPage doc={doc} /> }))`)
 * rather than hand-writing one page component per article.
 */
export default function DocPage({ doc }: Readonly<{ doc: DocEntry }>) {
  return (
    <DocLayout activeId={doc.id}>
      <DocArticle name={doc.id} source={doc.source} />
    </DocLayout>
  );
}
