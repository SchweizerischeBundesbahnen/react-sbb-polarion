/**
 * Where pdf-exporter looks for the widgets of a Live Report which can be exported alone. The report's own
 * "Export to PDF" button reads this set on the top window when it is clicked, and offers each widget whose
 * element is on the page. Part of the contract with pdf-exporter: never rename it.
 */
export const PDF_EXPORT_TARGETS_KEY = '__pdfExporterExportTargets';

/** A widget as it offers itself to pdf-exporter. */
export interface PdfExportTarget {
  /** What the choice calls the widget: "Only <title>". */
  title: string;
  /** An element of the widget on the report page, or null before the widget has rendered. */
  anchor: () => Element | null;
}

type TargetWindow = Window & typeof globalThis & { [PDF_EXPORT_TARGETS_KEY]?: Set<PdfExportTarget> };

/** The top window, or null where a page of another origin embeds this one. */
function topWindow(): TargetWindow | null {
  try {
    const top = (window.top ?? window) as TargetWindow;
    // Reading the document is what throws for another origin; window.top itself does not.
    return top.document ? top : null;
  } catch {
    return null;
  }
}

/** The iframe this document is shown in, or null at the top or in an iframe of another origin. */
function ownFrame(): Element | null {
  try {
    return window.frameElement;
  } catch {
    return null;
  }
}

/**
 * Offers a widget to the "Export to PDF" button of the Live Report it is on, which then lets the user export
 * that widget alone. Returns what withdraws the offer. Without pdf-exporter nothing reads the offer.
 *
 * A widget mounted in the report page passes an element of its own as `anchor`. An app shown in an iframe
 * of the widget passes none: the iframe is the widget's element then. An app which is not in an iframe and
 * passes no anchor is not a widget, and offers nothing.
 *
 * The export renders the widget on the server, so what the PDF shows is what the widget renders for a PDF.
 * An offer only names the widget.
 */
export function offerForPdfExport(title: string, anchor?: () => Element | null): () => void {
  const top = topWindow();
  const frame = anchor ? null : ownFrame();
  const resolve = anchor ?? (frame ? () => frame : null);
  if (!top || !resolve) {
    return () => {};
  }
  // The set is made by the top window, not by this one: an app in an iframe may be the first to offer, and a
  // set of its own would go with its document when the iframe is reloaded.
  top[PDF_EXPORT_TARGETS_KEY] ??= new top.Set<PdfExportTarget>();
  const targets = top[PDF_EXPORT_TARGETS_KEY];
  const target: PdfExportTarget = { title, anchor: resolve };
  targets.add(target);

  // A reloaded iframe offers itself again. Its old offer would call into a document which is gone. A page kept
  // in the back/forward cache comes back with its documents and nothing offers again, so its offers stay.
  const withdraw = () => {
    targets.delete(target);
    window.removeEventListener('pagehide', onPageHide);
  };
  const onPageHide = (event: PageTransitionEvent) => {
    if (!event.persisted) {
      withdraw();
    }
  };
  window.addEventListener('pagehide', onPageHide);
  return withdraw;
}
