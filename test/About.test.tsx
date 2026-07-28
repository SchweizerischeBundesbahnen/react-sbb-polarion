import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import About from '../src/components/About';
import type { ConfigurationPropertiesModel, ConfigurationStatus, Version } from '../src/types';
import { keydown } from './helpers';

// About fetches /version, /configuration-properties, /configuration-status and /readme in parallel via
// the injected sendRequest, then renders the info/properties/obsolete/status tables + README article.
// We build a per-case sendRequest returning real Response objects.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const VERSION: Version = {
  bundleName: 'Excel Importer',
  bundleVendor: 'SBB',
  supportEmail: 'support@example.com',
  automaticModuleName: 'ch.sbb.excel',
  bundleVersion: '6.1.2',
  bundleBuildTimestamp: '2026-07-01',
};

function makeSendRequest(overrides: {
  version?: Response;
  config?: ConfigurationPropertiesModel;
  configRes?: Response;
  statuses?: ConfigurationStatus[];
  readme?: Response;
}) {
  const config: ConfigurationPropertiesModel = overrides.config ?? { properties: [], obsoleteProperties: [] };
  return vi.fn(async ({ url }: { url: string }) => {
    if (url === '/version') return overrides.version ?? json(VERSION);
    if (url === '/configuration-properties') return overrides.configRes ?? json(config);
    if (url.startsWith('/configuration-status')) return json(overrides.statuses ?? []);
    if (url === '/readme') return overrides.readme ?? new Response('', { status: 404 });
    return new Response('', { status: 404 });
  });
}

const q = (sel: string) => document.querySelector(sel);
const rowsOf = (table: Element) =>
  Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim()),
  );

afterEach(cleanup);

describe('About', () => {
  it('renders the extension info table with a mailto for the support email', async () => {
    render(<About sendRequest={makeSendRequest({})} appIcon="/icon.svg" restApiUrl="/rest/api/version" />);
    await vi.waitFor(() => expect(q('.about-table')).not.toBeNull());
    const info = q('.about-table')!;
    expect(rowsOf(info)).toEqual([
      ['Bundle-Name', 'Excel Importer'],
      ['Bundle-Vendor', 'SBB'],
      ['Support-Email', 'support@example.com'],
      ['Automatic-Module-Name', 'ch.sbb.excel'],
      ['Bundle-Version', '6.1.2'],
      ['Bundle-Build-Timestamp', '2026-07-01'],
    ]);
    const mail = info.querySelector('a[href^="mailto:"]') as HTMLAnchorElement;
    expect(mail.getAttribute('href')).toBe('mailto:support@example.com');
    // app icon rendered.
    expect((q('.app-icon') as HTMLImageElement).getAttribute('src')).toBe('/icon.svg');
  });

  it('renders configuration properties and shows the RestAuthTest only when debug is true', async () => {
    const config: ConfigurationPropertiesModel = {
      properties: [
        { key: 'ch.sbb.excel.debug', value: 'true', defaultValue: 'false', description: 'Debug' },
        { key: 'ch.sbb.excel.other', value: 'x' },
      ],
      obsoleteProperties: [],
    };
    render(<About sendRequest={makeSendRequest({ config })} appIcon="/i.svg" restApiUrl="/rest/api/version" />);
    await vi.waitFor(() => expect(document.querySelectorAll('.about-table').length).toBeGreaterThanOrEqual(2));
    // The properties table (2nd) lists both properties.
    const tables = document.querySelectorAll('.about-table');
    expect(rowsOf(tables[1])).toEqual([
      ['ch.sbb.excel.debug', 'true', 'false', 'Debug'],
      ['ch.sbb.excel.other', 'x', '', ''],
    ]);
    // Debug on -> RestAuthTest section present.
    expect(
      Array.from(document.querySelectorAll('h3')).some((h) => h.textContent === 'REST API authentication test'),
    ).toBe(true);
  });

  it('hides the RestAuthTest when no debug property is true', async () => {
    const config: ConfigurationPropertiesModel = {
      properties: [{ key: 'ch.sbb.excel.debug', value: 'false' }],
      obsoleteProperties: [],
    };
    render(<About sendRequest={makeSendRequest({ config })} appIcon="/i.svg" restApiUrl="/r" />);
    await vi.waitFor(() => expect(q('.about-table')).not.toBeNull());
    expect(
      Array.from(document.querySelectorAll('h3')).some((h) => h.textContent === 'REST API authentication test'),
    ).toBe(false);
  });

  it('renders the obsolete-properties table only when there are obsolete properties', async () => {
    const config: ConfigurationPropertiesModel = {
      properties: [{ key: 'a', value: '1' }],
      obsoleteProperties: [{ key: 'old', value: 'v' }],
    };
    render(<About sendRequest={makeSendRequest({ config })} appIcon="/i.svg" restApiUrl="/r" />);
    await vi.waitFor(() =>
      expect(Array.from(document.querySelectorAll('h3')).some((h) => h.textContent?.includes('Obsolete'))).toBe(true),
    );
  });

  it('renders the configuration status table with a color per status', async () => {
    const statuses: ConfigurationStatus[] = [{ name: 'Apache POI', status: 'OK', details: 'v5' }];
    render(<About sendRequest={makeSendRequest({ statuses })} appIcon="/i.svg" restApiUrl="/r" />);
    await vi.waitFor(() =>
      expect(
        Array.from(document.querySelectorAll('h3')).some((h) => h.textContent === 'Extension configuration status'),
      ).toBe(true),
    );
    const statusCell = Array.from(document.querySelectorAll('td')).find((td) => td.textContent === 'OK') as HTMLElement;
    expect(statusCell.style.color).toBe('green');
  });

  it('renders the README documentation article when /readme returns HTML', async () => {
    render(
      <About
        sendRequest={makeSendRequest({ readme: new Response('<h1>Readme</h1>', { status: 200 }) })}
        appIcon="/i.svg"
        restApiUrl="/r"
      />,
    );
    await vi.waitFor(() => expect(q('article.markdown-body')).not.toBeNull());
    expect(q('article.markdown-body')!.querySelector('h1')?.textContent).toBe('Readme');
  });

  it('shows an error alert when a required endpoint fails, using its errorMessage', async () => {
    render(
      <About
        sendRequest={makeSendRequest({ version: json({ errorMessage: 'boom' }, 500) })}
        appIcon="/i.svg"
        restApiUrl="/r"
      />,
    );
    await vi.waitFor(() => expect(q('.alert-error')).not.toBeNull());
    expect(q('.alert-error')!.textContent).toContain('Failed to load About information (boom)');
  });

  it('blanks manifest entries the bundle does not declare and drops the support-email row', async () => {
    render(<About sendRequest={makeSendRequest({ version: json({}) })} appIcon="/i.svg" restApiUrl="/r" />);
    await vi.waitFor(() => expect(q('.about-table')).not.toBeNull());
    expect(rowsOf(q('.about-table')!)).toEqual([
      ['Bundle-Name', ''],
      ['Bundle-Vendor', ''],
      ['Automatic-Module-Name', ''],
      ['Bundle-Version', ''],
      ['Bundle-Build-Timestamp', ''],
    ]);
    expect(q('a[href^="mailto:"]')).toBeNull();
  });

  // The three required endpoints report a failure in whichever shape their handler happens to use, so
  // the page walks errorMessage -> message -> the bare status rather than trusting one of them.
  it('falls back to the message field when there is no errorMessage', async () => {
    render(
      <About
        sendRequest={makeSendRequest({ version: json({ message: 'nope' }, 500) })}
        appIcon="/i.svg"
        restApiUrl="/r"
      />,
    );
    await vi.waitFor(() => expect(q('.alert-error')).not.toBeNull());
    expect(q('.alert-error')!.textContent).toContain('Failed to load About information (nope)');
  });

  it('falls back to the HTTP status when the failure body is not JSON', async () => {
    render(
      <About
        sendRequest={makeSendRequest({ version: new Response('<html>Gateway</html>', { status: 503 }) })}
        appIcon="/i.svg"
        restApiUrl="/r"
      />,
    );
    await vi.waitFor(() => expect(q('.alert-error')).not.toBeNull());
    expect(q('.alert-error')!.textContent).toContain('Failed to load About information (HTTP 503)');
  });

  it('reports a request that throws outright', async () => {
    const sendRequest = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<About sendRequest={sendRequest} appIcon="/i.svg" restApiUrl="/r" />);
    await vi.waitFor(() => expect(q('.alert-error')).not.toBeNull());
    expect(q('.alert-error')!.textContent).toContain('Failed to load About information (offline)');
  });

  // Four endpoints are awaited in sequence, so the page can be left at three different points. Each
  // one is guarded, and none of them may write into an unmounted tree.
  it('ignores endpoints that resolve after unmount', async () => {
    // All four are awaited together, so every one of them has to settle for the guard to be reached.
    const settle: Array<(response: Response) => void> = [];
    const sendRequest = vi.fn(() => new Promise<Response>((resolve) => settle.push(resolve)));
    render(<About sendRequest={sendRequest} appIcon="/i.svg" restApiUrl="/r" />);
    await vi.waitFor(() => expect(settle).toHaveLength(4));

    cleanup();
    settle.forEach((resolve) => resolve(json(VERSION)));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(q('.about-table')).toBeNull();
  });

  it('ignores a body that finishes parsing after unmount', async () => {
    let parse!: (body: unknown) => void;
    // The responses resolve at once; their bodies do not, so the unmount lands between the two awaits.
    const pending = new Promise<unknown>((resolve) => (parse = resolve));
    const response = { ok: true, status: 200, json: () => pending, text: () => pending } as unknown as Response;
    const sendRequest = vi.fn(async () => response);
    render(<About sendRequest={sendRequest} appIcon="/i.svg" restApiUrl="/r" />);
    await vi.waitFor(() => expect(sendRequest).toHaveBeenCalledTimes(4));

    cleanup();
    parse(VERSION);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(q('.about-table')).toBeNull();
  });

  it('ignores a request that rejects after unmount', async () => {
    let fail!: (reason: Error) => void;
    const sendRequest = vi.fn(() => new Promise<Response>((_resolve, reject) => (fail = reject)));
    render(<About sendRequest={sendRequest} appIcon="/i.svg" restApiUrl="/r" />);
    await vi.waitFor(() => expect(document.body.textContent).toContain('Loading...'));

    cleanup();
    fail(new Error('offline'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(q('.alert-error')).toBeNull();
  });

  // Same-page links inside the README (and inside property descriptions) would otherwise resolve
  // against this page's embedded URL, leaking ?feature=&embedded=&scope= into the browser's hover
  // preview. They are rewritten into scroll targets that keep only the fragment.
  describe('in-page anchors', () => {
    const README =
      '<a href="#config-section">Jump to config</a>' +
      '<a href="#">Bare fragment</a>' +
      '<h2 id="config-section">Config</h2>';

    const anchors = () => Array.from(document.querySelectorAll<HTMLElement>('a.about-anchor'));

    async function renderReadme() {
      render(
        <About
          sendRequest={makeSendRequest({ readme: new Response(README, { status: 200 }) })}
          appIcon="/i.svg"
          restApiUrl="/r"
        />,
      );
      await vi.waitFor(() => expect(anchors()).toHaveLength(2));
    }

    it('strips the resolvable href and keeps only the fragment as the tooltip', async () => {
      await renderReadme();
      const [jump] = anchors();
      expect(jump.hasAttribute('href')).toBe(false);
      expect(jump.title).toBe('#config-section');
      expect(jump.getAttribute('role')).toBe('link');
      expect(jump.tabIndex).toBe(0);
    });

    it('scrolls to the target on click and on Enter or Space', async () => {
      const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
      try {
        await renderReadme();
        const [jump] = anchors();

        jump.click();
        expect(scrollIntoView).toHaveBeenCalledTimes(1);

        keydown(jump, 'Enter');
        expect(scrollIntoView).toHaveBeenCalledTimes(2);

        keydown(jump, ' ');
        expect(scrollIntoView).toHaveBeenCalledTimes(3);

        // Anything else must stay a normal keystroke.
        keydown(jump, 'a');
        expect(scrollIntoView).toHaveBeenCalledTimes(3);
      } finally {
        scrollIntoView.mockRestore();
      }
    });

    it('does nothing for a bare "#" fragment with no target', async () => {
      const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
      try {
        await renderReadme();
        const bare = anchors()[1];

        bare.click();
        keydown(bare, 'Enter');

        expect(scrollIntoView).not.toHaveBeenCalled();
      } finally {
        scrollIntoView.mockRestore();
      }
    });
  });
});
