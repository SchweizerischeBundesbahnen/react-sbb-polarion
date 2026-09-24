import { useMemo, useRef, useState } from 'react';
import { type DocSearchRecord, useDocs } from '../../docs/DocsContext';

const MAX_RESULTS = 8;

/** Ranks a record against the query terms: a hit in the heading counts more than one in the body, and every
 *  term must appear somewhere or the record is dropped. */
function score(record: DocSearchRecord, terms: string[]): number {
  const haystackTitle = `${record.docTitle} ${record.title}`.toLowerCase();
  const haystackText = record.text.toLowerCase();
  let total = 0;
  for (const term of terms) {
    const inTitle = haystackTitle.includes(term);
    const inText = haystackText.includes(term);
    if (!inTitle && !inText) {
      return 0; // require every term to match
    }
    total += (inTitle ? 3 : 0) + (inText ? 1 : 0);
  }
  return total;
}

/**
 * Client-side documentation search over the build-generated section index. Each result links to the article
 * and heading it came from (`?feature=<doc>#<anchor>`); the anchors match the rendered heading ids because
 * both come from the same slug algorithm (the build's section index and generateHeadingIds).
 */
export default function DocSearch() {
  const { searchIndex, featureHref } = useDocs();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      return [];
    }
    return searchIndex
      .map((record) => ({ record, score: score(record, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.record);
  }, [query, searchIndex]);

  const go = (record: DocSearchRecord) => {
    setOpen(false);
    setQuery('');
    const currentFeature = new URLSearchParams(window.location.search).get('feature');
    if (currentFeature === record.doc) {
      // already on the page: just scroll, no reload
      document.getElementById(record.anchor)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.assign(featureHref(record.doc, `#${record.anchor}`));
    }
  };

  if (searchIndex.length === 0) {
    return null;
  }

  return (
    <div
      className="docs-search"
      ref={containerRef}
      // Close only when focus leaves the whole widget, so Tabbing from the input into a result keeps the
      // list open (an input-blur timer would unmount it out from under the just-focused result button).
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <input
        type="search"
        className="docs-search-input"
        placeholder="Search documentation..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results.length > 0) {
            go(results[0]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && query.trim() !== '' && (
        <ul className="docs-search-results">
          {results.length === 0 ? (
            <li className="docs-search-empty">No matches</li>
          ) : (
            results.map((record) => (
              <li key={`${record.doc}#${record.anchor}`}>
                <button
                  type="button"
                  className="docs-search-result"
                  // Keep focus in the input on mouse press: Safari/Firefox on macOS do not focus a <button>
                  // on click, so without this the input blurs, the container onBlur closes the list, and the
                  // list unmounts before mouseup -> the click never lands. onClick still activates for both
                  // mouse and keyboard.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(record)}
                >
                  <span className="docs-search-result-doc">{record.docTitle}</span>
                  <span className="docs-search-result-title">{record.title}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
