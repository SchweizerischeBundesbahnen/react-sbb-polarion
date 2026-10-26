import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import BulkExportWidget, { bulkExportWidgetStyles } from '../src/widgets/BulkExportWidget';
import type { BulkExportItems } from '../src/widgets/bulkExportItems';
import { mountInShadowRoot } from '../src/widgets/shadowMount';
import {
  SAMPLE_ITEMS,
  SAMPLE_ITEMS_EMPTY,
  SAMPLE_ITEMS_TRUNCATED,
  SAMPLE_ITEMS_WITH_UNREADABLE,
} from './bulkExportSamples';
import { settleBeforeCapture, settleLayout } from './helpers';

// Docker-only snapshots of the widget as a report page shows it, mounted the way an extension mounts it: its
// own shadow root, carrying the widget's stylesheet, with the tokens inherited from the host. Polarion's page
// CSS is not loaded here, so these references show the widget's own styling - which is exactly what a change
// in this repo can move.

const hosts: HTMLElement[] = [];

function mounted(loadItems: () => Promise<BulkExportItems>): HTMLElement {
  const host = document.createElement('div');
  host.className = 'test-BulkExportWidget sbb-ui';
  document.body.appendChild(host);
  hosts.push(host);
  mountInShadowRoot(
    host,
    { styles: [bulkExportWidgetStyles], className: 'sbb-ui' },
    <BulkExportWidget title="Test Runs" exportLabel="Export to PDF" loadItems={loadItems} onExport={() => {}} />,
  );
  return host;
}

const withItems = (items: BulkExportItems) => mounted(() => Promise.resolve(items));

async function snapshot(host: HTMLElement, name: string): Promise<void> {
  // Park the pointer on the heading first. It carries no hover styling, while wherever the pointer happened to
  // rest after the previous test might - a link picking up its underline is enough to make a reference
  // disagree with itself from one run to the next.
  const heading = host.shadowRoot!.querySelector('h3');
  if (heading) {
    await userEvent.hover(heading);
  }
  await settleLayout();
  await page.viewport(1280, Math.ceil(host.scrollHeight) + 40);
  await settleBeforeCapture(false);
  await expect(page.elementLocator(host)).toMatchScreenshot(name);
}

const settled = (host: HTMLElement, selector = '.polarion-rpw-table-counts') =>
  vi.waitFor(() => expect(host.shadowRoot!.querySelector(selector)).not.toBeNull());

afterEach(async () => {
  hosts.splice(0).forEach((host) => host.remove());
  await page.viewport(1280, 720);
});

describe.skipIf(!__PIXEL_REFERENCES__)('BulkExportWidget visual', () => {
  it('the table of a loaded widget, nothing selected', async () => {
    const host = withItems(SAMPLE_ITEMS);
    await settled(host);

    await snapshot(host, 'widget-loaded');
  });

  it('a selection, which enables the export button', async () => {
    const host = withItems(SAMPLE_ITEMS);
    await settled(host);

    host.shadowRoot!.querySelectorAll<HTMLInputElement>('input.export-item')[1].click();
    await vi.waitFor(() =>
      expect(host.shadowRoot!.querySelector('#bulk-export')!.className).not.toContain('defaultCursor'),
    );

    await snapshot(host, 'widget-selection');
  });

  it('a row the user may not read', async () => {
    const host = withItems(SAMPLE_ITEMS_WITH_UNREADABLE);
    await settled(host);

    await snapshot(host, 'widget-unreadable-row');
  });

  it('more items found than the widget shows', async () => {
    const host = withItems(SAMPLE_ITEMS_TRUNCATED);
    await settled(host);

    await snapshot(host, 'widget-truncated');
  });

  it('the query behind the info icon', async () => {
    const host = withItems(SAMPLE_ITEMS);
    await settled(host);

    host.shadowRoot!.querySelector<HTMLElement>('.polarion-rpw-table-show-query img')!.click();
    await vi.waitFor(() => expect(host.shadowRoot!.querySelector('.polarion-rpw-table-query')).not.toBeNull());

    await snapshot(host, 'widget-query-shown');
  });

  it('a data set that found nothing', async () => {
    const host = withItems(SAMPLE_ITEMS_EMPTY);
    await settled(host);

    await snapshot(host, 'widget-empty');
  });

  it('an endpoint that refused the descriptor', async () => {
    const host = mounted(() =>
      Promise.reject(new Error('The widget descriptor is missing or was not signed by this server. Reload the page.')),
    );
    await settled(host, '.widget-error');

    await snapshot(host, 'widget-error');
  });
});
