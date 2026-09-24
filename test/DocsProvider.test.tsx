import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { DocsProvider, useDocs } from '../src/docs/DocsContext';

// The defaults DocsProvider applies when a consumer supplies only `docs` (the common case for a small
// documentation site): the fields the full-config DocsSite tests set explicitly are exercised here left
// unset, plus the prev/next neighbour lookup at both ends and off the list.

const DOCS = [
  { id: 'quick-start', title: 'Quick Start', source: 'QUICK_START.md' },
  { id: 'user-guide', title: 'User Guide', source: 'USER_GUIDE.md' },
  { id: 'upgrade', title: 'Upgrade', source: 'UPGRADE.md' },
];

function Probe() {
  const docs = useDocs();
  const mid = docs.neighbours('user-guide');
  return (
    <div>
      <span data-testid="root">{docs.breadcrumbRootLabel}</span>
      <span data-testid="landing">{docs.breadcrumbLandingId}</span>
      <span data-testid="article">{docs.articleHtmlUrl('quick-start')}</span>
      <span data-testid="href">{docs.featureHref('quick-start')}</span>
      <span data-testid="search">{docs.searchIndex.length}</span>
      <span data-testid="mdlink">{JSON.stringify(docs.mdLinkMap)}</span>
      <span data-testid="first-prev">{String(docs.neighbours('quick-start').prev)}</span>
      <span data-testid="last-next">{String(docs.neighbours('upgrade').next)}</span>
      <span data-testid="mid">{`${mid.prev?.id}>${mid.next?.id}`}</span>
      <span data-testid="unknown">{JSON.stringify(docs.neighbours('nope'))}</span>
    </div>
  );
}

const text = (testid: string) => document.querySelector(`[data-testid="${testid}"]`)?.textContent;

afterEach(() => cleanup());

describe('DocsProvider defaults', () => {
  it('applies the documented defaults when only `docs` is supplied', async () => {
    render(
      <DocsProvider config={{ docs: DOCS }}>
        <Probe />
      </DocsProvider>,
    );

    await vi.waitFor(() => expect(text('root')).toBe('Documentation'));
    expect(text('landing')).toBe('quick-start'); // first article
    expect(text('article')?.endsWith('/html/quick-start.html')).toBe(true);
    expect(text('href')).toContain('feature=quick-start');
    expect(text('search')).toBe('0'); // no search index -> empty
    expect(text('mdlink')).toBe('{}'); // no link map -> empty
  });

  it('resolves prev/next at both ends, in the middle, and off the list', async () => {
    render(
      <DocsProvider config={{ docs: DOCS }}>
        <Probe />
      </DocsProvider>,
    );

    await vi.waitFor(() => expect(text('first-prev')).toBe('null')); // first article has no previous
    expect(text('last-next')).toBe('null'); // last article has no next
    expect(text('mid')).toBe('quick-start>upgrade'); // middle article sees both neighbours
    expect(text('unknown')).toBe('{"prev":null,"next":null}'); // id not in the manifest
  });

  it('honours an explicit breadcrumb landing article over the default first', async () => {
    render(
      <DocsProvider config={{ docs: DOCS, breadcrumbLandingId: 'user-guide' }}>
        <Probe />
      </DocsProvider>,
    );
    await vi.waitFor(() => expect(text('landing')).toBe('user-guide'));
  });
});
