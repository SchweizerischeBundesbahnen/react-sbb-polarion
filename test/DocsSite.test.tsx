import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import DocArticle from '../src/components/documentation/DocArticle';
import DocLayout from '../src/components/documentation/DocLayout';
import DocLinkInterceptor from '../src/components/documentation/DocLinkInterceptor';
import DocPage from '../src/components/documentation/DocPage';
import { type DocsConfig, DocsProvider } from '../src/docs/DocsContext';
import { pageViolations } from '../src/testing';
import { keydown } from './helpers';

/** Set a controlled input's value the way React's onChange listens for (bypassing its value tracker). */
function typeInto(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// The documentation site: DocLayout (sidebar + search + on-this-page) around a DocArticle, driven by the
// manifest a DocsProvider supplies. DocArticle fetches its HTML, so we stub global fetch per case.

const origUrl = window.location.pathname + window.location.search + window.location.hash;

const CONFIG_HTML =
  '<h1 id="configuration">Configuration</h1>' +
  '<h2 id="weasyprint-configuration">WeasyPrint configuration</h2><p>Set the service URL.</p>' +
  '<h2 id="enabling-cors">Enabling CORS</h2><p>Allow origins.</p>';

const CONFIG: DocsConfig = {
  docs: [
    { id: 'quick-start', title: 'Quick Start', source: 'QUICK_START.md' },
    { id: 'user-guide', title: 'User Guide', source: 'USER_GUIDE.md' },
    { id: 'configuration', title: 'Configuration', source: 'CONFIGURATION.md' },
    { id: 'limitations', title: 'Limitations', source: 'LIMITATIONS.md' },
    { id: 'upgrade', title: 'Upgrade', source: 'UPGRADE.md' },
  ],
  searchIndex: [
    {
      doc: 'configuration',
      docTitle: 'Configuration',
      anchor: 'weasyprint-configuration',
      title: 'WeasyPrint configuration',
      text: 'Set the service URL.',
    },
    {
      doc: 'configuration',
      docTitle: 'Configuration',
      anchor: 'enabling-cors',
      title: 'Enabling CORS',
      text: 'Allow origins.',
    },
  ],
  articleHtmlUrl: (name) => `https://docs.test/${name}.html`,
  sourceBaseUrl: 'https://github.com/example/repo/blob/main',
  mdLinkMap: { 'CONFIGURATION.md': 'configuration', 'USER_GUIDE.md': 'user-guide' },
};

function stubFetch(html: string, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(html, { status })),
  );
}

function renderConfig(hash = '') {
  window.history.replaceState({}, '', `?feature=configuration&embedded=true${hash}`);
  return render(
    <DocsProvider config={CONFIG}>
      <DocLayout activeId="configuration">
        <DocArticle name="configuration" source="CONFIGURATION.md" />
      </DocLayout>
    </DocsProvider>,
  );
}

const q = (sel: string) => document.querySelector(sel);

/** Render a documentation article through DocPage - the single component every doc feature binds to. */
function renderDocPage(doc: DocsConfig['docs'][number]) {
  window.history.replaceState({}, '', `?feature=${doc.id}&embedded=true`);
  return render(
    <DocsProvider config={CONFIG}>
      <DocPage doc={doc} />
    </DocsProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', origUrl);
});

describe('DocPage', () => {
  it('renders the article for its manifest entry inside the sidebar frame, marked active', async () => {
    stubFetch(CONFIG_HTML);
    const configuration = CONFIG.docs[2];
    renderDocPage(configuration);

    await vi.waitFor(() => expect(q('article.markdown-body')).not.toBeNull());
    expect(document.body.textContent).toContain('WeasyPrint configuration');
    expect(q('.docs-nav-link-active')?.textContent).toBe('Configuration');
  });
});

describe('documentation site', () => {
  it('renders the article inside the sidebar frame with a flat nav and the current page active', async () => {
    stubFetch(CONFIG_HTML);
    renderConfig();

    await vi.waitFor(() => expect(q('article.markdown-body')).not.toBeNull());
    const links = Array.from(document.querySelectorAll('.docs-nav-link')).map((n) => n.textContent);
    expect(links).toEqual(['Quick Start', 'User Guide', 'Configuration', 'Limitations', 'Upgrade']);
    expect(q('.docs-nav-link-active')?.textContent).toBe('Configuration');
  });

  it('shows a "Documentation › <page>" breadcrumb linking back to the landing article', async () => {
    stubFetch(CONFIG_HTML);
    renderConfig();

    await vi.waitFor(() => expect(q('.docs-breadcrumb')).not.toBeNull());
    expect(q('.docs-breadcrumb-root')?.textContent).toBe('Documentation');
    expect(q('.docs-breadcrumb-current')?.textContent).toBe('Configuration');
    expect(q('.docs-breadcrumb-root')?.getAttribute('href')).toContain('feature=quick-start');
  });

  it('builds "on this page" from the article h2 headings', async () => {
    stubFetch(CONFIG_HTML);
    renderConfig();

    await vi.waitFor(() => {
      const entries = Array.from(document.querySelectorAll('.docs-onthispage .docs-toc-link')).map(
        (n) => n.textContent,
      );
      expect(entries).toEqual(['WeasyPrint configuration', 'Enabling CORS']);
    });
  });

  it('links prev/next by the manifest reading order', async () => {
    stubFetch(CONFIG_HTML);
    renderConfig();

    await vi.waitFor(() => expect(q('.docs-prevnext')).not.toBeNull());
    expect(q('.docs-prevnext-prev')?.textContent).toContain('User Guide');
    expect(q('.docs-prevnext-next')?.textContent).toContain('Limitations');
  });

  it('finds a section through search over the injected index', async () => {
    stubFetch(CONFIG_HTML);
    renderConfig();
    await vi.waitFor(() => expect(q('.docs-search-input')).not.toBeNull());

    typeInto(document.querySelector<HTMLInputElement>('.docs-search-input')!, 'CORS');
    await vi.waitFor(() => {
      const titles = Array.from(document.querySelectorAll('.docs-search-result-title')).map((n) => n.textContent);
      expect(titles).toContain('Enabling CORS');
    });
  });

  it('navigates to the section when a search result is clicked', async () => {
    stubFetch(CONFIG_HTML);
    const scrollIntoView = vi.fn();
    vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrollIntoView);
    renderConfig();
    await vi.waitFor(() => expect(q('.docs-search-input')).not.toBeNull());

    typeInto(document.querySelector<HTMLInputElement>('.docs-search-input')!, 'CORS');
    await vi.waitFor(() => expect(q('.docs-search-result')).not.toBeNull());
    document.querySelector<HTMLButtonElement>('.docs-search-result')!.click();

    // Already on the configuration page, so it scrolls to the section (no reload), closes the list and clears
    // the query. Also guards the onMouseDown(preventDefault)+onClick pair against a regression to mouse-only.
    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect((scrollIntoView.mock.instances[0] as HTMLElement).id).toBe('enabling-cors');
    expect(q('.docs-search-results')).toBeNull();
    expect((document.querySelector('.docs-search-input') as HTMLInputElement).value).toBe('');
  });

  it('opens the first result on Enter, but not once Escape has closed the list', async () => {
    stubFetch(CONFIG_HTML);
    const scrollIntoView = vi.fn();
    vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrollIntoView);
    renderConfig();
    await vi.waitFor(() => expect(q('.docs-search-input')).not.toBeNull());
    const input = document.querySelector<HTMLInputElement>('.docs-search-input')!;

    typeInto(input, 'CORS');
    await vi.waitFor(() => expect(q('.docs-search-result')).not.toBeNull());
    keydown(input, 'Escape');
    await vi.waitFor(() => expect(q('.docs-search-results')).toBeNull());
    keydown(input, 'Enter');
    expect(scrollIntoView).not.toHaveBeenCalled();

    // typing again reopens the list, and Enter then picks the first result
    typeInto(input, 'CORS origins');
    await vi.waitFor(() => expect(q('.docs-search-result')).not.toBeNull());
    keydown(input, 'Enter');
    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect((scrollIntoView.mock.instances[0] as HTMLElement).id).toBe('enabling-cors');
  });

  it('says so when nothing matches, and closes when focus leaves the widget', async () => {
    stubFetch(CONFIG_HTML);
    renderConfig();
    await vi.waitFor(() => expect(q('.docs-search-input')).not.toBeNull());
    const input = document.querySelector<HTMLInputElement>('.docs-search-input')!;

    input.focus();
    typeInto(input, 'nonexistent');
    await vi.waitFor(() => expect(q('.docs-search-empty')?.textContent).toBe('No matches'));

    // focus moving to something outside the search widget closes the list
    document.querySelector<HTMLAnchorElement>('.docs-nav-link')!.focus();
    await vi.waitFor(() => expect(q('.docs-search-results')).toBeNull());
  });

  it('names the search box, not only by its placeholder', async () => {
    stubFetch(CONFIG_HTML);
    renderConfig();
    await vi.waitFor(() => expect(q('.docs-search-input')).not.toBeNull());
    expect(q('.docs-search-input')!.getAttribute('aria-label')).toBe('Search documentation');
  });

  it('announces the number of results through a status that stays mounted', async () => {
    stubFetch(CONFIG_HTML);
    renderConfig();
    await vi.waitFor(() => expect(q('.docs-search-input')).not.toBeNull());
    const input = document.querySelector<HTMLInputElement>('.docs-search-input')!;
    const status = q('.docs-search-status')!;
    // <output> carries the status role, and with it a polite live region.
    expect(status.tagName).toBe('OUTPUT');
    expect(status.textContent).toBe('');

    typeInto(input, 'CORS');
    await vi.waitFor(() => expect(status.textContent).toBe('1 result'));
    typeInto(input, 'o');
    await vi.waitFor(() => expect(status.textContent).toBe('2 results'));
    typeInto(input, 'nonexistent');
    await vi.waitFor(() => expect(status.textContent).toBe('No matches'));
    keydown(input, 'Escape');
    await vi.waitFor(() => expect(status.textContent).toBe(''));
    expect(q('.docs-search-status')).toBe(status);
  });

  it('marks the "on this page" entry of the current section with aria-current', async () => {
    stubFetch(CONFIG_HTML);
    vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    renderConfig();
    await vi.waitFor(() => expect(document.querySelectorAll('.docs-toc-link')).toHaveLength(2));
    const [first, second] = Array.from(document.querySelectorAll<HTMLButtonElement>('.docs-toc-link'));

    second.click();
    await vi.waitFor(() => expect(second.getAttribute('aria-current')).toBe('location'));
    expect(first.hasAttribute('aria-current')).toBe(false);
  });

  it('follows an in-page anchor on Enter but leaves Space to the page, as a native link does', async () => {
    stubFetch('<h2 id="enabling-cors">Enabling CORS</h2><p>See <a href="#enabling-cors">here</a>.</p>');
    const scrollIntoView = vi.fn();
    vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrollIntoView);
    renderConfig();
    await vi.waitFor(() => expect(q('article.markdown-body .docs-anchor')).not.toBeNull());
    const anchor = q('article.markdown-body .docs-anchor') as HTMLElement;

    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    anchor.dispatchEvent(space);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(space.defaultPrevented).toBe(false);

    keydown(anchor, 'Enter');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('turns the article’s own #anchor links into scroll targets without an href', async () => {
    stubFetch('<h2 id="enabling-cors">Enabling CORS</h2><p>See <a href="#weasyprint-configuration">above</a>.</p>');
    renderConfig();

    await vi.waitFor(() => expect(q('article.markdown-body .docs-anchor')).not.toBeNull());
    const anchor = q('article.markdown-body .docs-anchor')!;
    expect(anchor.getAttribute('href')).toBeNull();
    expect(anchor.getAttribute('role')).toBe('link');
    expect(anchor.getAttribute('title')).toBe('#weasyprint-configuration');
  });

  it('scrolls to the URL fragment once the fetched article is in the DOM', async () => {
    stubFetch(CONFIG_HTML);
    const scrollIntoView = vi.fn();
    vi.spyOn(window.HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrollIntoView);
    renderConfig('#weasyprint-configuration');

    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect((scrollIntoView.mock.instances[0] as HTMLElement).id).toBe('weasyprint-configuration');
  });

  it('shows a "not generated" fallback linking to the source when the article is absent', async () => {
    stubFetch('', 404);
    renderConfig();

    await vi.waitFor(() => expect(document.body.textContent).toContain('has not been generated'));
    expect(q('a[href="https://github.com/example/repo/blob/main/CONFIGURATION.md"]')).not.toBeNull();
  });
});

describe('DocLinkInterceptor', () => {
  it.each([
    {
      kind: 'a .html article link',
      href: 'configuration.html#bulk-processing-api-key',
      hash: '#bulk-processing-api-key',
    },
    {
      kind: 'a .md source mapped through mdLinkMap',
      href: 'CONFIGURATION.md#weasyprint-configuration',
      hash: '#weasyprint-configuration',
    },
    { kind: 'a ./-prefixed .html article link', href: './configuration.html#enabling-cors', hash: '#enabling-cors' },
  ])('routes $kind through onDocLinkNavigate to its feature', async ({ href, hash }) => {
    const onDocLinkNavigate = vi.fn(() => true);
    render(
      <DocsProvider config={{ ...CONFIG, onDocLinkNavigate }}>
        <DocLinkInterceptor>
          <a href={href}>to configuration</a>
        </DocLinkInterceptor>
      </DocsProvider>,
    );

    await vi.waitFor(() => expect(document.querySelector('a')).not.toBeNull());
    document.querySelector<HTMLAnchorElement>('a')!.click();
    expect(onDocLinkNavigate).toHaveBeenCalledWith('configuration', hash);
  });

  it('opens a repo-relative link (e.g. docs/openapi.json) at the source base URL', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <DocsProvider config={CONFIG}>
        <DocLinkInterceptor>
          <a href="docs/openapi.json">OpenAPI</a>
        </DocLinkInterceptor>
      </DocsProvider>,
    );

    await vi.waitFor(() => expect(document.querySelector('a')).not.toBeNull());
    document.querySelector<HTMLAnchorElement>('a')!.click();
    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/example/repo/blob/main/docs/openapi.json',
      '_blank',
      'noopener',
    );
  });

  it('leaves the app’s own site-absolute ?feature= links to the browser (does not hijack them)', async () => {
    const onDocLinkNavigate = vi.fn(() => true);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <DocsProvider config={{ ...CONFIG, onDocLinkNavigate }}>
        <DocLinkInterceptor>
          <a href="/polarion/pdf-exporter-app/ui/app/index.html?feature=quick-start&embedded=true">Quick Start</a>
        </DocLinkInterceptor>
      </DocsProvider>,
    );

    await vi.waitFor(() => expect(document.querySelector('a')).not.toBeNull());
    // Stop the browser from actually following the (un-intercepted) link and navigating the test iframe;
    // the point is only that the interceptor left it alone.
    const preventNav = (e: Event) => e.preventDefault();
    document.addEventListener('click', preventNav);
    try {
      document
        .querySelector<HTMLAnchorElement>('a')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } finally {
      document.removeEventListener('click', preventNav);
    }
    expect(onDocLinkNavigate).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('leaves query-relative ?feature= links from a custom featureHref to the browser (no source-repo tab)', async () => {
    const onDocLinkNavigate = vi.fn(() => true);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const featureHref = (feature: string, hash = '') => `?feature=${feature}${hash}`;
    window.history.replaceState({}, '', '?feature=configuration');
    render(
      <DocsProvider config={{ ...CONFIG, featureHref, onDocLinkNavigate }}>
        <DocLinkInterceptor>
          <DocLayout activeId="configuration">
            <p>body</p>
          </DocLayout>
        </DocLinkInterceptor>
      </DocsProvider>,
    );

    await vi.waitFor(() => expect(q('.docs-nav-link')).not.toBeNull());
    const preventNav = (e: Event) => e.preventDefault();
    document.addEventListener('click', preventNav);
    try {
      // a sidebar link and a prev/next link, both relative `?feature=` URLs
      for (const sel of ['.docs-nav-link', '.docs-prevnext-next']) {
        const link = document.querySelector<HTMLAnchorElement>(sel)!;
        expect(link.getAttribute('href')).toMatch(/^\?feature=/);
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    } finally {
      document.removeEventListener('click', preventNav);
    }
    expect(onDocLinkNavigate).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('routes an .html link to a non-article page that mdLinkMap maps to (e.g. about.html)', async () => {
    const onDocLinkNavigate = vi.fn(() => true);
    render(
      <DocsProvider config={{ ...CONFIG, mdLinkMap: { ...CONFIG.mdLinkMap, 'README.md': 'about' }, onDocLinkNavigate }}>
        <DocLinkInterceptor>
          <a href="about.html">About</a>
        </DocLinkInterceptor>
      </DocsProvider>,
    );

    await vi.waitFor(() => expect(document.querySelector('a')).not.toBeNull());
    document.querySelector<HTMLAnchorElement>('a')!.click();
    expect(onDocLinkNavigate).toHaveBeenCalledWith('about', '');
  });

  it('opens an .html link no feature renders at the source base URL instead of switching to it', async () => {
    const onDocLinkNavigate = vi.fn(() => true);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <DocsProvider config={{ ...CONFIG, onDocLinkNavigate }}>
        <DocLinkInterceptor>
          <a href="changelog.html">Changelog</a>
        </DocLinkInterceptor>
      </DocsProvider>,
    );

    await vi.waitFor(() => expect(document.querySelector('a')).not.toBeNull());
    document.querySelector<HTMLAnchorElement>('a')!.click();
    expect(onDocLinkNavigate).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/example/repo/blob/main/changelog.html',
      '_blank',
      'noopener',
    );
  });

  it('does not resolve a link named like an Object.prototype member through mdLinkMap', async () => {
    const onDocLinkNavigate = vi.fn(() => true);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <DocsProvider config={{ ...CONFIG, onDocLinkNavigate }}>
        <DocLinkInterceptor>
          <a href="constructor">inherited name</a>
        </DocLinkInterceptor>
      </DocsProvider>,
    );

    await vi.waitFor(() => expect(document.querySelector('a')).not.toBeNull());
    document.querySelector<HTMLAnchorElement>('a')!.click();
    // not a feature switch to the inherited Object constructor - a plain repo-relative link instead
    expect(onDocLinkNavigate).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith('https://github.com/example/repo/blob/main/constructor', '_blank', 'noopener');
  });

  it('leaves a non-doc link alone', async () => {
    const onDocLinkNavigate = vi.fn(() => true);
    render(
      <DocsProvider config={{ ...CONFIG, onDocLinkNavigate }}>
        <DocLinkInterceptor>
          <a href="#in-page">in page</a>
        </DocLinkInterceptor>
      </DocsProvider>,
    );

    await vi.waitFor(() => expect(document.querySelector('a')).not.toBeNull());
    document
      .querySelector<HTMLAnchorElement>('a')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onDocLinkNavigate).not.toHaveBeenCalled();
  });
});

describe('documentation site accessibility', () => {
  it('has no WCAG A/AA violations on an article page', async () => {
    stubFetch(
      '<h1 id="configuration">Configuration</h1><h2 id="weasyprint-configuration">WeasyPrint configuration</h2>' +
        '<p>See <a href="#enabling-cors">below</a>.</p><h2 id="enabling-cors">Enabling CORS</h2><p>Allow origins.</p>',
    );
    renderDocPage(CONFIG.docs[2]);
    await vi.waitFor(() => expect(q('article.markdown-body .docs-anchor')).not.toBeNull());
    await vi.waitFor(() => expect(q('.docs-onthispage .docs-toc-link')).not.toBeNull());
    expect(await pageViolations()).toEqual([]);
  });

  it('has no WCAG A/AA violations with search results and with no match', async () => {
    stubFetch(CONFIG_HTML);
    renderConfig();
    await vi.waitFor(() => expect(q('.docs-search-input')).not.toBeNull());
    const input = document.querySelector<HTMLInputElement>('.docs-search-input')!;

    input.focus();
    typeInto(input, 'CORS');
    await vi.waitFor(() => expect(q('.docs-search-result')).not.toBeNull());
    expect(await pageViolations()).toEqual([]);

    typeInto(input, 'nonexistent');
    await vi.waitFor(() => expect(q('.docs-search-empty')).not.toBeNull());
    expect(await pageViolations()).toEqual([]);
  });

  it('has no WCAG A/AA violations on the "not generated" fallback', async () => {
    stubFetch('', 404);
    renderConfig();
    await vi.waitFor(() => expect(document.body.textContent).toContain('has not been generated'));
    expect(await pageViolations()).toEqual([]);
  });
});
