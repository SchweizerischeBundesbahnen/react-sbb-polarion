import type { SendRequest } from '../types';

/** A column of the widget's table, as the widget was configured on the page. */
export interface BulkExportColumn {
  id: string;
  label: string;
}

/**
 * One row. An item the current user may not read carries only `message`: the widget shows that instead
 * of the cells, exactly as Polarion's own tables do.
 */
export interface BulkExportItem {
  readable: boolean;
  message?: string | null;
  type?: string | null;
  projectId?: string | null;
  spaceId?: string | null;
  id?: string | null;
  name?: string | null;
  cells?: string[] | null;
}

/** What `/widgets/bulk-export/items` answers. */
export interface BulkExportItems {
  columns: BulkExportColumn[];
  items: BulkExportItem[];
  totalCount: number;
  countMessage: string;
  openInTableUrl?: string | null;
  query?: string | null;
}

/**
 * What the widget renderer of generic (`AbstractBulkExportWidgetRenderer`) puts on the shim element.
 * `descriptor` and `signature` are opaque here: they are passed back to the endpoint unchanged, which is
 * what lets the server trust the query they carry. `title` is presentation only, so that the widget's
 * frame renders before the rows arrive.
 */
export interface BulkExportWidgetShim {
  descriptor: string;
  signature: string;
  title: string;
}

/** The items endpoint generic registers, relative to the extension's REST root. */
export const BULK_EXPORT_ITEMS_URL = '/widgets/bulk-export/items';

const LOAD_ERROR = 'Could not load the items of this widget.';

/** Reads what the widget renderer put on the shim element, with empty values where an attribute is missing. */
export function readBulkExportWidgetShim(host: HTMLElement): BulkExportWidgetShim {
  return {
    descriptor: host.dataset.descriptor ?? '',
    signature: host.dataset.signature ?? '',
    title: host.dataset.title ?? '',
  };
}

/**
 * Asks the extension's items endpoint for the rows of a widget. Rejects with an Error whose message is what
 * the endpoint said, so that the widget can show it: the endpoint answers 400 for a descriptor it did not
 * sign, which is what an open page sees after a server restart.
 */
export async function loadBulkExportItems(
  sendRequest: SendRequest,
  shim: Pick<BulkExportWidgetShim, 'descriptor' | 'signature'>,
): Promise<BulkExportItems> {
  const response = await sendRequest({
    method: 'POST',
    url: BULK_EXPORT_ITEMS_URL,
    contentType: 'application/json',
    body: JSON.stringify({ descriptor: shim.descriptor, signature: shim.signature }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.errorMessage ?? LOAD_ERROR);
  }
  // A table, or the widget would wait for rows forever
  if (!Array.isArray(payload?.items) || !Array.isArray(payload?.columns)) {
    throw new TypeError(LOAD_ERROR);
  }
  return payload as BulkExportItems;
}
