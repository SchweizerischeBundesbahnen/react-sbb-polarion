import { afterEach, describe, expect, it, vi } from 'vitest';
import tokenStyles from '../src/generic/css/control-tokens.css?inline';
import { a11yViolations } from '../src/testing';
import BulkExportWidget, { bulkExportWidgetStyles } from '../src/widgets/BulkExportWidget';
import { adoptPageStyles, mountInShadowRoot } from '../src/widgets/shadowMount';
import { SAMPLE_ITEMS } from './bulkExportSamples';

// How a widget gets onto a report page: the renderer emits a shim element, and the widget app turns it into a
// shadow root of its own. The page around it belongs to Polarion, so nothing may leak either way.

const hosts: HTMLElement[] = [];

function shim(): HTMLElement {
  const host = document.createElement('div');
  host.className = 'test-BulkExportWidget sbb-ui';
  document.body.appendChild(host);
  hosts.push(host);
  return host;
}

const widget = (
  <BulkExportWidget
    title="Test Runs"
    exportLabel="Export"
    loadItems={() => Promise.resolve(SAMPLE_ITEMS)}
    onExport={() => {}}
  />
);

const mount = (host: HTMLElement) =>
  mountInShadowRoot(host, { styles: [bulkExportWidgetStyles], className: 'sbb-ui test-app' }, widget);

afterEach(() => {
  hosts.splice(0).forEach((host) => host.remove());
  document.head.querySelectorAll('link[data-test-stylesheet]').forEach((link) => link.remove());
});

describe('mountInShadowRoot', () => {
  it('renders the widget into a shadow root of the shim', async () => {
    const host = shim();

    expect(mount(host)).toBe(host.shadowRoot);

    await vi.waitFor(() => expect(host.shadowRoot!.querySelector('h3')?.textContent).toBe('Test Runs'));
    // The page sees none of it: the widget's markup is behind the shadow boundary
    expect(document.querySelector('.polarion-rpw-table-content')).toBeNull();
    await vi.waitFor(() =>
      expect(host.shadowRoot!.querySelectorAll('.polarion-rpw-table-content-row')).toHaveLength(4),
    );
  });

  it('gives the shadow root the given styles, and the container its class', async () => {
    const host = shim();

    mount(host);

    const styles = Array.from(host.shadowRoot!.querySelectorAll('style')).map((style) => style.textContent);
    expect(styles).toEqual([bulkExportWidgetStyles]);
    expect(host.shadowRoot!.querySelector('div')?.className).toBe('sbb-ui test-app');
  });

  it('mounts a shim only once, however often the module is imported', async () => {
    const host = shim();
    mount(host);
    await vi.waitFor(() => expect(host.shadowRoot!.querySelector('h3')).not.toBeNull());

    expect(mount(host)).toBeNull();

    expect(host.shadowRoot!.querySelectorAll('h3')).toHaveLength(1);
  });

  it('outranks the page stylesheet where the two disagree', async () => {
    // Polarion's own rule for the query block is `display: none`, its widget toggling the element's inline
    // style. This widget renders the block only while it is shown, so the cloned page stylesheet would keep it
    // invisible on a report page. The given styles are injected after the clones for exactly this reason.
    const pageCss = document.createElement('link');
    pageCss.rel = 'stylesheet';
    pageCss.setAttribute('data-test-stylesheet', '');
    pageCss.href = `data:text/css,${encodeURIComponent('.polarion-rpw-table-query{display:none}')}`;
    document.head.appendChild(pageCss);

    const host = shim();
    mount(host);
    await vi.waitFor(() => expect(host.shadowRoot!.querySelector('.polarion-rpw-table-show-query')).not.toBeNull());

    // The clone has to be in effect, or this would pass for the wrong reason
    const clone = Array.from(host.shadowRoot!.querySelectorAll('link')).find((link) =>
      link.href.startsWith('data:text/css'),
    )!;
    await vi.waitFor(() => expect(clone.sheet).not.toBeNull());

    host.shadowRoot!.querySelector<HTMLElement>('.polarion-rpw-table-show-query img')!.click();

    const query = await vi.waitFor(() => {
      const shown = host.shadowRoot!.querySelector('.polarion-rpw-table-query');
      expect(shown).not.toBeNull();
      return shown!;
    });
    expect(getComputedStyle(query).display).toBe('block');
  });

  it('draws the checkboxes from the tokens the host carries', async () => {
    const host = shim();
    mount(host);
    const checkbox = await vi.waitFor(() => {
      const found = host.shadowRoot!.querySelector<HTMLInputElement>('input.export-item');
      expect(found).not.toBeNull();
      return found!;
    });

    expect(getComputedStyle(checkbox).appearance).toBe('none');
    expect(getComputedStyle(checkbox).backgroundImage).toContain('data:image/svg+xml');
  });

  it('takes its font from the tokens in its own root, mounted as the README shows', async () => {
    // A plain shim, as generic renders it on a page with no tokens of its own: the tokens come in with the
    // library's stylesheet and sit on the container, which a rule on :host cannot see
    const host = document.createElement('div');
    document.body.appendChild(host);
    hosts.push(host);
    mountInShadowRoot(host, { styles: [tokenStyles, bulkExportWidgetStyles], className: 'sbb-ui' }, widget);

    const container = host.shadowRoot!.querySelector<HTMLElement>('.sbb-ui')!;
    const token = getComputedStyle(container).getPropertyValue('--sbb-control-font-family').trim();
    await vi.waitFor(() => expect(host.shadowRoot!.querySelector('h3')).not.toBeNull());

    const unquoted = (families: string) => families.replace(/["']/g, '').replace(/\s*,\s*/g, ',');
    expect(token).not.toBe('');
    expect(unquoted(getComputedStyle(host.shadowRoot!.querySelector('h3')!).fontFamily)).toBe(unquoted(token));
  });
});

describe('adoptPageStyles', () => {
  it('brings the page stylesheets into the shadow root, so the widget looks like the page it is on', () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/polarion/ria/some-polarion-stylesheet.css';
    link.setAttribute('data-test-stylesheet', '');
    document.head.appendChild(link);
    const root = shim().attachShadow({ mode: 'open' });

    adoptPageStyles(root);

    // The clone carries the resolved URL, which is what makes the stylesheet's own relative urls resolve
    const adopted = Array.from(root.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    expect(adopted.map((clone) => clone.href)).toContain(
      `${window.location.origin}/polarion/ria/some-polarion-stylesheet.css`,
    );
  });
});

describe('accessibility', () => {
  it('has no WCAG A/AA violations in its shadow root', async () => {
    const host = shim();
    mount(host);
    await vi.waitFor(() => expect(host.shadowRoot!.querySelector('.polarion-rpw-table-counts')).not.toBeNull());

    expect(await a11yViolations(host)).toEqual([]);
  });
});
