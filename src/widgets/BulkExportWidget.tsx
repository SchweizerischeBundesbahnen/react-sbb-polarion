import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import type { BulkExportItem, BulkExportItems } from './bulkExportItems';
import bulkExportWidgetCss from './bulkExportWidget.css?inline';

/**
 * The stylesheet of {@link BulkExportWidget}, as a string for its shadow root (see `mountInShadowRoot`). It is
 * not in style.css: its selectors are Polarion's table classes, which would restyle any page that loads the
 * library.
 */
export const bulkExportWidgetStyles: string = bulkExportWidgetCss;

const LOAD_ERROR = 'Could not load the items of this widget.';

export interface BulkExportWidgetProps {
  /** What the widget lists, e.g. "Documents": its heading, and the noun of its hint. */
  title: string;
  /**
   * Gets the rows, usually `loadBulkExportItems` over the extension's REST root. Rejects with an Error whose
   * message the widget shows. Called once, when the widget mounts.
   */
  loadItems: () => Promise<BulkExportItems>;
  /** The label of the export button, e.g. "Export to PDF". */
  exportLabel: string;
  /** The id of the export button, which the extension's system tests find it by. */
  exportButtonId?: string;
  /** Called with the selected rows when the export button is pressed. Never with an empty selection. */
  onExport: (items: BulkExportItem[]) => void;
  /** Called with the selected rows whenever the selection changes. */
  onSelectionChange?: (items: BulkExportItem[]) => void;
  /** The widget's header, e.g. to find the widget on the page. */
  headerRef?: Ref<HTMLDivElement>;
  /** Rendered after the table: the extension's dialogs, which then live in the widget's shadow root too. */
  children?: ReactNode;
}

/**
 * A bulk export widget on a report page: the table of what the widget's data set found, a checkbox per row,
 * and the export button that hands the selection to the extension.
 *
 * The rows are asked for over REST rather than rendered into the page, which is what makes the widget
 * testable and previewable outside Polarion. The cells arrive as the HTML Polarion rendered for them, so
 * that fields keep the icons, links and colors they have in every other Polarion table.
 */
export default function BulkExportWidget({
  title,
  loadItems,
  exportLabel,
  exportButtonId = 'bulk-export',
  onExport,
  onSelectionChange,
  headerRef,
  children,
}: BulkExportWidgetProps) {
  const [data, setData] = useState<BulkExportItems | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [queryShown, setQueryShown] = useState(false);

  // The rows are loaded once. Held in a ref, so that a loader the caller recreates on every render does not
  // ask the endpoint again with each of them.
  const load = useRef(loadItems);
  useEffect(() => {
    let active = true;
    load.current().then(
      (items) => active && setData(items),
      (failure: Error) => active && setError(failure.message || LOAD_ERROR),
    );
    return () => {
      active = false;
    };
  }, []);

  const selectableIndexes = useMemo(
    () => (data?.items ?? []).map((item, index) => ({ item, index })).filter(({ item }) => item.readable),
    [data],
  );
  const selectedItems: BulkExportItem[] = useMemo(
    () => selectableIndexes.filter(({ index }) => selected.has(index)).map(({ item }) => item),
    [selectableIndexes, selected],
  );
  const allSelected = selectableIndexes.length > 0 && selected.size === selectableIndexes.length;

  const selectionListener = useRef(onSelectionChange);
  useEffect(() => {
    selectionListener.current = onSelectionChange;
  }, [onSelectionChange]);
  useEffect(() => {
    selectionListener.current?.(selectedItems);
  }, [selectedItems]);

  const toggle = (index: number) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(index)) {
        next.add(index);
      }
      return next;
    });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectableIndexes.map(({ index }) => index)));

  const startExport = () => {
    if (selectedItems.length > 0) {
      onExport(selectedItems);
    }
  };

  const columns = data?.columns ?? [];
  const exportDisabled = selectedItems.length === 0;

  return (
    <>
      <div className="header" ref={headerRef}>
        <h3>{title}</h3>
        <span
          className="polarion-TestsExecutionButton-link"
          title={exportDisabled ? 'Please, select at least one item to be exported first' : undefined}
        >
          <div
            id={exportButtonId}
            role="button"
            tabIndex={0}
            aria-disabled={exportDisabled}
            className={`polarion-TestsExecutionButton-buttons${
              exportDisabled ? ' polarion-TestsExecutionButton-buttons-defaultCursor' : ''
            }`}
            onClick={startExport}
            onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && startExport()}
          >
            <table className="polarion-TestsExecutionButton-buttons-content">
              <tbody>
                <tr>
                  <td className="polarion-TestsExecutionButton-buttons-content-labelCell">
                    <div className="polarion-TestsExecutionButton-labelTextNew">{exportLabel}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </span>
        <div>
          <p>Please select {title} below which you want to export and click button above</p>
        </div>
      </div>

      {error && <div className="widget-error">{error}</div>}

      {!error && !data && (
        <div className="widget-loading">
          <span className="sbb-spinner" role="img" aria-label="Loading" />
        </div>
      )}

      {data && (
        <div className="export-items">
          <table className="polarion-rpw-table-main">
            <tbody>
              <tr>
                <td>
                  <table className="polarion-rpw-table-content">
                    <tbody>
                      <tr className="polarion-rpw-table-header-row">
                        <th>
                          <input
                            type="checkbox"
                            id="export-all"
                            aria-label="Select all"
                            checked={allSelected}
                            ref={(input) => {
                              if (input) {
                                input.indeterminate = selected.size > 0 && !allSelected;
                              }
                            }}
                            onChange={toggleAll}
                          />
                        </th>
                        {columns.map((column) => (
                          <th key={column.id}>{column.label}</th>
                        ))}
                      </tr>
                      {data.items.map((item, index) =>
                        item.readable ? (
                          <tr className="polarion-rpw-table-content-row" key={`${item.projectId}/${item.id}/${index}`}>
                            <td>
                              <input
                                type="checkbox"
                                className="export-item"
                                aria-label={item.name ?? item.id ?? ''}
                                data-type={item.type ?? undefined}
                                data-project={item.projectId ?? undefined}
                                data-space={item.spaceId ?? undefined}
                                data-id={item.id ?? undefined}
                                checked={selected.has(index)}
                                onChange={() => toggle(index)}
                              />
                            </td>
                            {(item.cells ?? []).map((cell, cellIndex) => (
                              // The cell is the HTML Polarion rendered for that field of that item
                              <td
                                key={columns[cellIndex]?.id ?? cellIndex}
                                dangerouslySetInnerHTML={{ __html: cell }}
                              />
                            ))}
                          </tr>
                        ) : (
                          <tr className="polarion-rpw-table-content-row" key={`unreadable-${index}`}>
                            <td colSpan={columns.length + 1} className="polarion-rpw-table-not-readable-cell">
                              {item.message}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td className="polarion-rpw-table-footer">
                  <div className="polarion-rpw-table-counts">
                    {data.openInTableUrl ? (
                      <a href={data.openInTableUrl} target="_top">
                        {data.countMessage}
                      </a>
                    ) : (
                      data.countMessage
                    )}
                  </div>
                  {data.openInTableUrl && (
                    <div className="polarion-rpw-table-open-in-table">
                      <a href={data.openInTableUrl} target="_blank" rel="noreferrer" aria-label="Open in Table">
                        {/* Polarion's own icons, by the URL its tables use. Decorative on purpose: the
                            accessible name sits on the control, and where the icon is not served - a dev
                            harness without a Polarion, the reference screenshots - an empty alt leaves a
                            blank instead of stray words in the middle of the footer. */}
                        <img
                          src="/polarion/ria/images/portlet/portletOpenInTable.png"
                          title="Open in Table"
                          alt=""
                          width={16}
                          height={16}
                        />
                      </a>
                    </div>
                  )}
                  {data.query && (
                    <div className="polarion-rpw-table-show-query">
                      <button
                        type="button"
                        title="Show Query"
                        aria-label="Show Query"
                        aria-expanded={queryShown}
                        onClick={() => setQueryShown((shown) => !shown)}
                      >
                        <img src="/polarion/ria/images/portlet/info.png" alt="" width={16} height={16} />
                      </button>
                    </div>
                  )}
                  {data.query && queryShown && <div className="polarion-rpw-table-query">{data.query}</div>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {children}
    </>
  );
}
