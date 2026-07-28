import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import About from '../src/components/About';
import type { ConfigurationPropertiesModel, ConfigurationStatus, Version } from '../src/types';

// Visual-regression states for the shared About page. Kept separate from the behavior tests
// (Docker-only, since any toMatchScreenshot file diffs on non-Linux font antialiasing). References live
// in test/expected/About/ and MUST be generated in Docker (npm run test:update:docker).
//
// The page is four stacked tables plus the README article. It is captured section by section rather
// than in one shot: the whole page is ~850px tall, past the 720px test viewport, and an element
// screenshot taller than the viewport comes back clipped (the first attempt lost the last status row
// and the entire README). Each section below is well inside the viewport, and each one isolates a
// distinct decision the stylesheet makes - the icon pinned top-right, the bordered header cells, the
// per-severity colour, the markdown headings.
//
// The icon is an inline data: URI - a real URL would 404 in the runner and screenshot as a broken-image
// glyph, which differs between platforms. The README fixture carries no <pre>/<code> on purpose: their
// monospace styling comes from the github-markdown-light.css the consuming app links, not from RSP.

const APP_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">' +
      '<rect width="48" height="48" rx="6" fill="#2f6f6b"/>' +
      '<rect x="12" y="14" width="24" height="4" fill="#fff"/>' +
      '<rect x="12" y="22" width="24" height="4" fill="#fff"/>' +
      '<rect x="12" y="30" width="16" height="4" fill="#fff"/>' +
      '</svg>',
  );

const VERSION: Version = {
  bundleName: 'Excel Importer',
  bundleVendor: 'SBB',
  supportEmail: 'support@example.com',
  automaticModuleName: 'ch.sbb.polarion.extension.excel.importer',
  bundleVersion: '6.1.2',
  bundleBuildTimestamp: '2026-07-01 09:14:22',
};

const CONFIG: ConfigurationPropertiesModel = {
  properties: [
    {
      key: 'ch.sbb.excel.importer.debug',
      value: 'false',
      defaultValue: 'false',
      description: 'Enables the REST authentication test on this page.',
    },
    {
      key: 'ch.sbb.excel.importer.maxRows',
      value: '5000',
      defaultValue: '1000',
      description: 'Largest sheet the importer will accept.',
    },
  ],
  obsoleteProperties: [{ key: 'ch.sbb.excel.importer.legacyMode', value: 'true' }],
};

const STATUSES: ConfigurationStatus[] = [
  { name: 'Apache POI', status: 'OK', details: 'v5.2.5' },
  { name: 'Mapping "Requirements"', status: 'WARNING', details: 'References a work item type that no longer exists.' },
  { name: 'Mapping "Obsolete"', status: 'ERROR', details: 'Cannot be parsed.' },
];

const README = '<h1>Excel Importer</h1><p>Imports work items from a spreadsheet into Polarion.</p>';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const origUrl = window.location.pathname + window.location.search;

let container: HTMLDivElement | undefined;

function mount(sendRequest: Parameters<typeof About>[0]['sendRequest']) {
  // Embedded is how Polarion serves the page; it also drops the dev-only back link, which keeps the
  // capture about the About content itself.
  window.history.replaceState({}, '', '?embedded=true');
  container = document.createElement('div');
  container.className = 'sbb-ui standard-admin-page';
  container.style.width = '980px';
  container.style.background = '#fff';
  document.body.appendChild(container);
  render(<About sendRequest={sendRequest} appIcon={APP_ICON} restApiUrl="/polarion/x/rest/api/version" />, {
    container,
  });
}

const fullPage = () =>
  vi.fn(async ({ url }: { url: string }) => {
    if (url === '/version') return json(VERSION);
    if (url === '/configuration-properties') return json(CONFIG);
    if (url.startsWith('/configuration-status')) return json(STATUSES);
    return new Response(README, { status: 200 });
  });

const shot = (name: string) => expect(page.elementLocator(container as HTMLElement)).toMatchScreenshot(name);

afterEach(() => {
  cleanup();
  container?.remove();
  container = undefined;
  window.history.replaceState({}, '', origUrl);
});

/** The table blocks are addressed through their headings, never by index: the obsolete-properties
 *  section is absent for most extensions, so a positional lookup silently captures the wrong table. */
function sectionUnder(heading: string): HTMLElement {
  const h3 = Array.from(document.querySelectorAll('h3')).find((h) => h.textContent === heading);
  if (!h3) throw new Error(`heading not found: ${heading}`);
  // "Extension info" is the one heading wrapped together with the app icon in .about-header, so the
  // table follows that wrapper rather than the heading itself.
  const anchor = h3.parentElement?.classList.contains('about-header') ? h3.parentElement : h3;
  const wrap = anchor.nextElementSibling as HTMLElement;
  if (wrap?.className !== 'about-table-wrap') throw new Error(`no table follows the "${heading}" heading`);
  return wrap;
}

const sectionShot = (element: HTMLElement, name: string) =>
  expect(page.elementLocator(element)).toMatchScreenshot(name);

async function mountLoaded() {
  mount(fullPage());
  await vi.waitFor(() => expect(document.querySelector('article.markdown-body')).not.toBeNull());
}

describe.skipIf(!__PIXEL_REFERENCES__)('About visual states', () => {
  it('header keeps the extension icon pinned opposite the heading', async () => {
    await mountLoaded();
    await sectionShot(document.querySelector('.about-header') as HTMLElement, 'about-header');
  });

  it('extension info table, support email rendered as a link', async () => {
    await mountLoaded();
    await sectionShot(sectionUnder('Extension info'), 'about-info-table');
  });

  it('configuration properties table, four columns with the description last', async () => {
    await mountLoaded();
    await sectionShot(sectionUnder('Extension configuration properties'), 'about-properties');
  });

  it('obsolete properties table, the narrow two-column variant', async () => {
    await mountLoaded();
    await sectionShot(sectionUnder('Obsolete/non-valid configuration properties'), 'about-obsolete');
  });

  it('status table colours one row per severity', async () => {
    await mountLoaded();
    await sectionShot(sectionUnder('Extension configuration status'), 'about-status-colours');
  });

  it('README article picks up the bundled markdown headings', async () => {
    await mountLoaded();
    await sectionShot(document.querySelector('article.markdown-body') as HTMLElement, 'about-readme');
  });

  it('a page that could not be loaded shows only the error banner', async () => {
    mount(vi.fn(async () => json({ errorMessage: 'Polarion is not reachable.' }, 500)));
    await vi.waitFor(() => expect(document.querySelector('.alert-error')).not.toBeNull());
    await shot('about-load-error');
  });
});
