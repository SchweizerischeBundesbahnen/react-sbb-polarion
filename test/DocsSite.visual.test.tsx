import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import DocPage from '../src/components/documentation/DocPage';
import { type DocsConfig, DocsProvider } from '../src/docs/DocsContext';
import { settleBeforeCapture } from './helpers';

/** Set a controlled input's value the way React's onChange listens for (bypassing its value tracker). */
function typeInto(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Visual-regression states for the documentation site: DocPage = DocLayout (breadcrumb, sidebar with search,
// navigation and "on this page", prev/next) around a fetched DocArticle. Kept separate from the behavior
// tests (DocsSite.test.tsx) since any toMatchScreenshot file diffs on non-Linux font antialiasing.
// References live in test/expected/DocsSite/ and MUST be generated in Docker (npm run test:update:docker).
//
// Each state stays inside the 720px test viewport (a taller element screenshot comes back clipped). Like the
// UserGuide fixture, the article carries no <pre>/<code>: their monospace look comes from the consuming app's
// github-markdown-light.css, which RSP does not load here.

const ARTICLE =
  '<h1 id="configuration">Configuration</h1>' +
  '<p>Point the extension at a running WeasyPrint service before the first export.</p>' +
  '<h2 id="weasyprint-configuration">WeasyPrint configuration</h2>' +
  '<p>Set the service URL and, when the service requires one, its access token.</p>' +
  '<h3 id="timeouts">Timeouts</h3>' +
  '<p>Large documents may need a longer read timeout than the default.</p>' +
  '<h2 id="enabling-cors">Enabling CORS</h2>' +
  '<p>Allow the Polarion origin when the service runs on another host.</p>';

const CONFIG: DocsConfig = {
  docs: [
    { id: 'quick-start', title: 'Quick Start', source: 'QUICK_START.md' },
    { id: 'user-guide', title: 'User Guide', source: 'USER_GUIDE.md' },
    { id: 'configuration', title: 'Configuration', source: 'CONFIGURATION.md' },
    { id: 'upgrade', title: 'Upgrade', source: 'UPGRADE.md' },
  ],
  searchIndex: [
    {
      doc: 'configuration',
      docTitle: 'Configuration',
      anchor: 'weasyprint-configuration',
      title: 'WeasyPrint configuration',
      text: 'Set the service URL and its access token.',
    },
    {
      doc: 'upgrade',
      docTitle: 'Upgrade',
      anchor: 'weasyprint-service',
      title: 'Moving to the WeasyPrint service',
      text: 'The embedded renderer was removed.',
    },
  ],
  articleHtmlUrl: (name) => `https://docs.test/${name}.html`,
  sourceBaseUrl: 'https://github.com/example/repo/blob/main',
};

const origUrl = window.location.pathname + window.location.search + window.location.hash;
let container: HTMLDivElement | undefined;

function mount(fetchImpl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  window.history.replaceState({}, '', '?feature=configuration&embedded=true');
  container = document.createElement('div');
  container.className = 'sbb-ui standard-admin-page';
  container.style.width = '1000px';
  container.style.padding = '16px';
  container.style.background = '#fff';
  document.body.appendChild(container);
  render(
    <DocsProvider config={CONFIG}>
      <DocPage doc={CONFIG.docs[2]} />
    </DocsProvider>,
    { container },
  );
}

const q = (sel: string) => document.querySelector(sel);

const frames = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const shot = async (name: string) => {
  await settleBeforeCapture();
  return expect(page.elementLocator(container as HTMLElement)).toMatchScreenshot(name);
};

afterEach(() => {
  cleanup();
  container?.remove();
  container = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', origUrl);
});

describe.skipIf(!__PIXEL_REFERENCES__)('Documentation site visual states', () => {
  it('article with breadcrumb, sidebar navigation, on-this-page and prev/next', async () => {
    // No real scrolling: the capture must not depend on where a smooth scroll happens to be.
    vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    mount(async () => new Response(ARTICLE, { status: 200 }));
    await vi.waitFor(() => expect(q('.docs-onthispage .docs-toc-link')).not.toBeNull());

    // Pin the highlighted section explicitly instead of leaving it to the IntersectionObserver's first
    // callback: let that callback run, then select the first entry, which is what the reader would see.
    await frames();
    document.querySelector<HTMLButtonElement>('.docs-onthispage .docs-toc-link')!.click();
    await vi.waitFor(() => expect(q('.docs-toc-link-active')?.textContent).toBe('WeasyPrint configuration'));
    await shot('docs-article');
  });

  it('search results listed under the search box', async () => {
    mount(async () => new Response(ARTICLE, { status: 200 }));
    await vi.waitFor(() => expect(q('article.markdown-body')).not.toBeNull());

    const input = document.querySelector<HTMLInputElement>('.docs-search-input')!;
    input.focus();
    typeInto(input, 'weasyprint');
    await vi.waitFor(() => expect(document.querySelectorAll('.docs-search-result')).toHaveLength(2));
    await shot('docs-search-results');
  });

  it('"not generated" fallback linking to the source', async () => {
    mount(async () => new Response('', { status: 404 }));
    await vi.waitFor(() => expect(document.body.textContent).toContain('has not been generated'));
    await shot('docs-not-generated');
  });
});
