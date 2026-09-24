import { type RefObject, useEffect, useState } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface OnThisPageProps {
  /** The container DocArticle renders into; its h2/h3 become the on-this-page entries. */
  contentRef: RefObject<HTMLElement | null>;
}

/**
 * The "On this page" table of contents, built at runtime from the rendered article's h2/h3 headings - not
 * from the build - so the anchors are exactly the ids the headings carry, with no risk of drift. A
 * MutationObserver rebuilds it when the article loads in; an IntersectionObserver highlights the section
 * currently in view.
 */
export default function OnThisPage({ contentRef }: Readonly<OnThisPageProps>) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  // Rebuild the list whenever the article content changes (it is fetched asynchronously).
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const rebuild = () => {
      const headings = Array.from(root.querySelectorAll<HTMLElement>('h2[id], h3[id]'));
      setItems(headings.map((h) => ({ id: h.id, text: h.textContent ?? '', level: Number(h.tagName[1]) })));
    };
    rebuild();
    const observer = new MutationObserver(rebuild);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [contentRef]);

  // Highlight the heading nearest the top of the viewport as the reader scrolls.
  useEffect(() => {
    const root = contentRef.current;
    if (!root || items.length === 0) return;
    const headings = items.map((item) => document.getElementById(item.id)).filter((h): h is HTMLElement => h !== null);
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const top = visible.reduce(
            (a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b),
            visible[0],
          );
          setActiveId(top.target.id);
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [contentRef, items]);

  if (items.length === 0) {
    return null;
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setActiveId(id);
  };

  return (
    <nav className="docs-onthispage" aria-label="On this page">
      <div className="docs-onthispage-title">On this page</div>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={`docs-toc-l${item.level}`}>
            <button
              type="button"
              className={item.id === activeId ? 'docs-toc-link docs-toc-link-active' : 'docs-toc-link'}
              aria-current={item.id === activeId ? 'location' : undefined}
              onClick={() => scrollTo(item.id)}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
