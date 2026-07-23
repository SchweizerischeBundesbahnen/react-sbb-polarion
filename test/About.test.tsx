import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import About from '../src/components/About';
import type { ConfigurationPropertiesModel, ConfigurationStatus, Version } from '../src/types';

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
});
