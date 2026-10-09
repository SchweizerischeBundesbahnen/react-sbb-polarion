import { useEffect, useRef } from 'react';
import { offerForPdfExport } from '../services/pdfExportTargets';

/**
 * {@link offerForPdfExport} for a component: the widget is offered while the component is mounted.
 *
 * The anchor may be a new function on every render. The offer is made once per title and always calls the
 * anchor of the latest render.
 */
export function useOfferForPdfExport(title: string, anchor?: () => Element | null): void {
  const latest = useRef(anchor);
  useEffect(() => {
    latest.current = anchor;
  });
  const anchored = anchor !== undefined;

  useEffect(() => offerForPdfExport(title, anchored ? () => latest.current?.() ?? null : undefined), [title, anchored]);
}
