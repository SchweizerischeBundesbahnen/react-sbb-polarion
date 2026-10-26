import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { pageViolations } from '../src/testing';
import BulkExportWidget from '../src/widgets/BulkExportWidget';
import type { BulkExportWidgetProps } from '../src/widgets/BulkExportWidget';
import type { BulkExportItems } from '../src/widgets/bulkExportItems';
import {
  SAMPLE_ITEMS,
  SAMPLE_ITEMS_EMPTY,
  SAMPLE_ITEMS_TRUNCATED,
  SAMPLE_ITEMS_WITHOUT_TABLE_VIEW,
  SAMPLE_ITEMS_WITH_UNREADABLE,
} from './bulkExportSamples';

// The widget as a report page shows it. Rendered without its shadow root here: what this suite is about is
// the behavior - what the table does with the rows, and what the export button hands to the extension. The
// shadow root is covered by shadowMount.test.tsx, the look by the visual suite.

const rows = () => Array.from(document.querySelectorAll('.polarion-rpw-table-content-row'));
const checkboxes = () => Array.from(document.querySelectorAll<HTMLInputElement>('input.export-item'));
const selectAll = () => document.querySelector<HTMLInputElement>('#export-all')!;
const exportButton = () => document.querySelector<HTMLElement>('#bulk-export')!;
const isDisabled = () => exportButton().classList.contains('polarion-TestsExecutionButton-buttons-defaultCursor');

const open = (items: BulkExportItems = SAMPLE_ITEMS, props: Partial<BulkExportWidgetProps> = {}) =>
  render(
    <BulkExportWidget
      title="Test Runs"
      exportLabel="Export"
      loadItems={() => Promise.resolve(items)}
      onExport={() => {}}
      {...props}
    />,
  );

afterEach(async () => {
  await cleanup();
});

describe('BulkExportWidget', () => {
  it('renders the widget frame before the rows arrive', async () => {
    let deliver!: (items: BulkExportItems) => void;
    const pending = new Promise<BulkExportItems>((resolve) => (deliver = resolve));
    await open(SAMPLE_ITEMS, { loadItems: () => pending });

    // The title and the button come from the props, so they are there while the request is in flight
    await vi.waitFor(() => expect(document.querySelector('h3')?.textContent).toBe('Test Runs'));
    expect(exportButton()).not.toBeNull();
    expect(document.querySelector('.widget-loading')).not.toBeNull();

    deliver(SAMPLE_ITEMS);
    await vi.waitFor(() => expect(document.querySelector('.widget-loading')).toBeNull());
    expect(rows().length).toBe(4);
  });

  it('asks for the rows once, however often it renders', async () => {
    const loadItems = vi.fn(() => Promise.resolve(SAMPLE_ITEMS));
    const view = await open(SAMPLE_ITEMS, { loadItems });
    await vi.waitFor(() => expect(rows().length).toBe(4));

    // A new loader on each render, as a caller with an inline arrow passes it
    await view.rerender(
      <BulkExportWidget title="Test Runs" exportLabel="Export" loadItems={() => loadItems()} onExport={() => {}} />,
    );
    await userEvent.click(checkboxes()[0]);

    expect(loadItems).toHaveBeenCalledTimes(1);
  });

  it('names its button as the extension asks', async () => {
    await open(SAMPLE_ITEMS, { exportLabel: 'Export to PDF', exportButtonId: 'bulk-export-pdf' });

    await vi.waitFor(() => expect(document.querySelector('#bulk-export-pdf')?.textContent).toBe('Export to PDF'));
    expect(document.querySelector('p')?.textContent).toBe(
      'Please select Test Runs below which you want to export and click button above',
    );
  });

  it('renders a column per configured field and the cells as Polarion rendered them', async () => {
    await open();

    await vi.waitFor(() => expect(rows().length).toBe(4));
    expect(
      Array.from(document.querySelectorAll('.polarion-rpw-table-header-row th')).map((th) => th.textContent),
    ).toEqual(['', 'ID', 'Status', 'Template', 'Author', 'Created']);
    // The cell HTML is used as it arrived: the link Polarion rendered is a link, not escaped text
    expect(rows()[0].querySelector('td:nth-child(2) a')?.textContent).toBe('build_quick-20170211-141155');
  });

  it('marks each row with the item it stands for', async () => {
    await open();

    await vi.waitFor(() => expect(rows().length).toBe(4));
    const first = checkboxes()[0];
    expect(first.dataset).toMatchObject({ type: 'TestRun', project: 'elibrary', id: 'build_quick-20170211-141155' });
    expect(first.dataset.space).toBeUndefined();
    expect(first).toHaveAccessibleName('build_quick-20170211-141155');
  });

  it('shows an item the user may not read as a message across the table', async () => {
    await open(SAMPLE_ITEMS_WITH_UNREADABLE);

    await vi.waitFor(() => expect(rows().length).toBe(3));
    const cell = rows()[2].querySelector('.polarion-rpw-table-not-readable-cell')!;
    expect(cell.textContent).toBe('You do not have permission to read this item');
    expect(cell.getAttribute('colspan')).toBe('6');
    // ... and it cannot be exported
    expect(checkboxes().length).toBe(2);
  });

  it('keeps the export button disabled until something is selected', async () => {
    await open();
    await vi.waitFor(() => expect(rows().length).toBe(4));

    expect(isDisabled()).toBe(true);
    expect(exportButton().getAttribute('aria-disabled')).toBe('true');
    expect(document.querySelector('.polarion-TestsExecutionButton-link')?.getAttribute('title')).toContain(
      'select at least one item',
    );

    await userEvent.click(checkboxes()[0]);
    expect(isDisabled()).toBe(false);
    expect(document.querySelector('.polarion-TestsExecutionButton-link')?.hasAttribute('title')).toBe(false);

    await userEvent.click(checkboxes()[0]);
    expect(isDisabled()).toBe(true);
  });

  it('selects and clears every row from the header checkbox', async () => {
    await open();
    await vi.waitFor(() => expect(rows().length).toBe(4));

    await userEvent.click(selectAll());
    expect(checkboxes().every((checkbox) => checkbox.checked)).toBe(true);

    await userEvent.click(selectAll());
    expect(checkboxes().some((checkbox) => checkbox.checked)).toBe(false);
  });

  it('shows the header checkbox as indeterminate while only some rows are selected', async () => {
    await open();
    await vi.waitFor(() => expect(rows().length).toBe(4));

    await userEvent.click(checkboxes()[0]);
    expect(selectAll().indeterminate).toBe(true);
    expect(selectAll().checked).toBe(false);

    await userEvent.click(checkboxes()[1]);
    await userEvent.click(checkboxes()[2]);
    await userEvent.click(checkboxes()[3]);
    expect(selectAll().indeterminate).toBe(false);
    expect(selectAll().checked).toBe(true);
  });

  it('hands the selected rows to the extension when the button is pressed', async () => {
    const onExport = vi.fn();
    await open(SAMPLE_ITEMS, { onExport });
    await vi.waitFor(() => expect(rows().length).toBe(4));

    await userEvent.click(checkboxes()[1]);
    await userEvent.click(checkboxes()[3]);
    await userEvent.click(exportButton());

    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport.mock.calls[0][0].map((item: { id: string }) => item.id)).toEqual(['0_9b RT', '1_0 UAT']);
  });

  it('exports from the keyboard as well', async () => {
    const onExport = vi.fn();
    await open(SAMPLE_ITEMS, { onExport });
    await vi.waitFor(() => expect(rows().length).toBe(4));
    await userEvent.click(checkboxes()[0]);

    exportButton().focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await userEvent.keyboard('a');

    expect(onExport).toHaveBeenCalledTimes(2);
  });

  it('keeps the page where it is when Space presses the button', async () => {
    const onExport = vi.fn();
    await open(SAMPLE_ITEMS, { onExport });
    await vi.waitFor(() => expect(rows().length).toBe(4));
    await userEvent.click(checkboxes()[0]);

    // The button is a div, so the browser would scroll the report page on Space
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    exportButton().dispatchEvent(space);

    expect(space.defaultPrevented).toBe(true);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('shows its own message when the loader rejects with nothing', async () => {
    await open(SAMPLE_ITEMS, { loadItems: () => Promise.reject(undefined) });

    await vi.waitFor(() =>
      expect(document.querySelector('.widget-error')?.textContent).toBe('Could not load the items of this widget.'),
    );
  });

  it('does not export with nothing selected', async () => {
    const onExport = vi.fn();
    await open(SAMPLE_ITEMS, { onExport });
    await vi.waitFor(() => expect(rows().length).toBe(4));

    // Clicked directly: the button reports itself as disabled, which Playwright refuses to click
    exportButton().click();

    expect(onExport).not.toHaveBeenCalled();
  });

  it('reports the selection as it changes', async () => {
    const onSelectionChange = vi.fn();
    await open(SAMPLE_ITEMS, { onSelectionChange });
    await vi.waitFor(() => expect(rows().length).toBe(4));

    await userEvent.click(checkboxes()[1]);
    await userEvent.click(checkboxes()[2]);

    await vi.waitFor(() =>
      expect(onSelectionChange).toHaveBeenLastCalledWith([SAMPLE_ITEMS.items[1], SAMPLE_ITEMS.items[2]]),
    );
  });

  it('gives the extension its header and renders the extension dialogs after the table', async () => {
    const header = { current: null as HTMLDivElement | null };
    await open(SAMPLE_ITEMS, { headerRef: header, children: <div className="extension-dialog">dialog</div> });
    await vi.waitFor(() => expect(rows().length).toBe(4));

    expect(header.current?.querySelector('h3')?.textContent).toBe('Test Runs');
    expect(document.querySelector('.export-items + .extension-dialog')).not.toBeNull();
  });

  it('reports how many items were found and links to the table view', async () => {
    await open();

    await vi.waitFor(() => expect(rows().length).toBe(4));
    expect(document.querySelector('.polarion-rpw-table-counts')?.textContent).toBe('4 items found');
    expect(document.querySelector('.polarion-rpw-table-open-in-table a')?.getAttribute('href')).toBe(
      '/polarion/#/project/elibrary/testruns',
    );
  });

  it('shows the count as text where there is no table view, and no query marker without a query', async () => {
    await open(SAMPLE_ITEMS_WITHOUT_TABLE_VIEW);

    await vi.waitFor(() => expect(rows().length).toBe(4));
    expect(document.querySelector('.polarion-rpw-table-counts')?.textContent).toBe('4 items found');
    expect(document.querySelector('.polarion-rpw-table-counts a')).toBeNull();
    expect(document.querySelector('.polarion-rpw-table-open-in-table')).toBeNull();
    expect(document.querySelector('.polarion-rpw-table-show-query')).toBeNull();
  });

  it('shows the query behind the info icon on demand', async () => {
    await open();
    await vi.waitFor(() => expect(rows().length).toBe(4));

    expect(document.querySelector('.polarion-rpw-table-query')).toBeNull();
    await userEvent.click(document.querySelector<HTMLElement>('.polarion-rpw-table-show-query img')!);
    expect(document.querySelector('.polarion-rpw-table-query')?.textContent).toBe(
      'type:testrun AND project.id:elibrary',
    );

    await userEvent.click(document.querySelector<HTMLElement>('.polarion-rpw-table-show-query img')!);
    expect(document.querySelector('.polarion-rpw-table-query')).toBeNull();
  });

  it('renders an empty data set as an empty table, not as an error', async () => {
    await open(SAMPLE_ITEMS_EMPTY);

    await vi.waitFor(() =>
      expect(document.querySelector('.polarion-rpw-table-counts')?.textContent).toBe('0 items found'),
    );
    expect(rows().length).toBe(0);
    expect(document.querySelector('.widget-error')).toBeNull();
    expect(isDisabled()).toBe(true);
    expect(selectAll().checked).toBe(false);
  });

  it('shows why the rows could not be loaded', async () => {
    await open(SAMPLE_ITEMS, { loadItems: () => Promise.reject(new Error('Reload the page.')) });

    await vi.waitFor(() => expect(document.querySelector('.widget-error')?.textContent).toBe('Reload the page.'));
    expect(document.querySelector('.export-items')).toBeNull();
    expect(document.querySelector('.widget-loading')).toBeNull();
  });

  it('says something even when the failure does not', async () => {
    await open(SAMPLE_ITEMS, { loadItems: () => Promise.reject(new Error('')) });

    await vi.waitFor(() =>
      expect(document.querySelector('.widget-error')?.textContent).toBe('Could not load the items of this widget.'),
    );
  });

  it('ignores rows that arrive after it is gone', async () => {
    let deliver!: (items: BulkExportItems) => void;
    let fail!: (error: Error) => void;
    const error = vi.spyOn(console, 'error');
    await open(SAMPLE_ITEMS, { loadItems: () => new Promise((resolve) => (deliver = resolve)) });
    await vi.waitFor(() => expect(deliver).toBeDefined());
    await cleanup();
    await open(SAMPLE_ITEMS, { loadItems: () => new Promise((_resolve, reject) => (fail = reject)) });
    await vi.waitFor(() => expect(fail).toBeDefined());
    await cleanup();

    deliver(SAMPLE_ITEMS);
    fail(new Error('too late'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('accessibility', () => {
  const loaded = async (count = 4) => {
    await vi.waitFor(() => expect(rows().length).toBe(count));
  };

  it('has no WCAG A/AA violations with the table loaded and nothing selected', async () => {
    await open();
    await loaded();
    expect(await pageViolations()).toEqual([]);
  });

  it('has no WCAG A/AA violations with a selection and the query shown', async () => {
    await open();
    await loaded();
    await userEvent.click(checkboxes()[1]);
    await vi.waitFor(() => expect(isDisabled()).toBe(false));
    await userEvent.click(document.querySelector<HTMLElement>('.polarion-rpw-table-show-query button')!);
    await vi.waitFor(() => expect(document.querySelector('.polarion-rpw-table-query')).not.toBeNull());
    expect(await pageViolations()).toEqual([]);
  });

  it('has no WCAG A/AA violations with a row the user may not read', async () => {
    await open(SAMPLE_ITEMS_WITH_UNREADABLE);
    await vi.waitFor(() => expect(document.querySelector('.polarion-rpw-table-not-readable-cell')).not.toBeNull());
    expect(await pageViolations()).toEqual([]);
  });

  it('has no WCAG A/AA violations with more items found than the widget shows', async () => {
    await open(SAMPLE_ITEMS_TRUNCATED);
    await vi.waitFor(() => expect(document.querySelector('.polarion-rpw-table-counts')).not.toBeNull());
    expect(await pageViolations()).toEqual([]);
  });

  it('has no WCAG A/AA violations when the rows could not be loaded', async () => {
    await open(SAMPLE_ITEMS, { loadItems: () => Promise.reject(new Error('Reload the page.')) });
    await vi.waitFor(() => expect(document.querySelector('.widget-error')).not.toBeNull());
    expect(await pageViolations()).toEqual([]);
  });
});
