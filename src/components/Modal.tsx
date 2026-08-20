import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import './Modal.css';

interface ModalProps {
  open: boolean;
  title: string;
  okText?: string;
  cancelText?: string;
  /** Disable the primary (OK) button, e.g. while an async action triggered by onOk is in progress. */
  okDisabled?: boolean;
  onOk: () => void;
  onCancel: () => void;
  children: ReactNode;
}

/**
 * Shared modal dialog - the canonical SBB 2606 look (dark header with white title/close, teal
 * primary/secondary footer buttons). Overlay, header with a close button, content, and a footer with
 * Cancel / primary-OK buttons. Closes on Escape or backdrop click. `onOk` does NOT auto-close, so an
 * async handler (e.g. an export) can run and show its own result while the dialog stays open; the
 * caller closes via `onCancel`. Footer buttons use the generic unified button system (`sbb-btn`); its
 * CSS and this component's own styles are bundled in the library's stylesheet.
 *
 * Built on the native `<dialog>`, which supplies for free what a `<div>` overlay has to reimplement
 * badly: the top layer (so nothing on the page can paint over it), the `::backdrop` pseudo-element,
 * Escape-to-dismiss, and - the part that was actually missing before - moving focus into the dialog on
 * open and restoring it to the opener on close.
 */
export default function Modal({
  open,
  title,
  okText = 'Accept',
  cancelText = 'Cancel',
  okDisabled = false,
  onOk,
  onCancel,
  children,
}: Readonly<ModalProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Set by the `cancel` handler below, which fires for a close REQUEST - Escape or the light dismiss -
  // and not for the buttons. The focus cleanup needs to tell those apart; see it for why.
  const closedByRequest = useRef(false);

  // showModal() is what makes it modal; the `open` attribute alone renders a non-modal dialog with no
  // backdrop and no focus handling, so this cannot be expressed declaratively in the JSX.
  //
  // Layout, not passive: a <dialog> that has not been shown is display:none, so a passive effect would
  // leave it mounted-but-invisible until after paint. Opening it in the commit phase keeps "mounted"
  // and "shown" the same instant - no frame in which the dialog exists without its backdrop.
  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;

    // Read before showModal(): the control that opened the dialog, and whether it was showing a focus
    // ring at the time. A mouse click focuses a control without one; tabbing to it and pressing Enter
    // leaves one. After showModal() the active element is the dialog, so this cannot be read later.
    //
    // document.activeElement stops at a shadow host, and the form-extension panels mount into one, so
    // the walk down through shadowRoot.activeElement is what reaches the control the user pressed
    // rather than the element hosting it.
    let opener = document.activeElement as HTMLElement | null;
    while (opener?.shadowRoot?.activeElement) {
      opener = opener.shadowRoot.activeElement as HTMLElement;
    }
    const openerHadRing = !!opener?.matches?.(':focus-visible');
    // This component survives `open` toggling, and so does the ref: without the reset, the first
    // dismissal would make every later close of the same instance look like a close request.
    closedByRequest.current = false;

    dialog?.showModal();
    // The dialog focusing steps land on the first focusable descendant, which here is the close button
    // - so Enter, pressed straight after opening, would dismiss the dialog. Focus the dialog itself
    // instead: nothing is armed, and a screen reader announces the dialog by its title. Done here
    // rather than with `autoFocus`, because React does not render that as the attribute the focusing
    // steps read; it focuses the node itself, which is not the same thing for a <dialog>.
    dialog?.focus();

    return () => {
      dialog?.close();
      // Closing gives focus back to the opener, and :focus-visible then judges by the LAST interaction
      // - so dismissing with Escape paints a ring on a button the user only ever clicked. Take the
      // focus off again in exactly that case, and only there. Three conditions, each ruling out a user
      // who should keep the focus they have:
      //   - the opener had no ring when it opened the dialog, so it was reached with the pointer;
      //   - the close was a close request (Escape, light dismiss) rather than a button, so a user who
      //     tabbed to Cancel and pressed Enter - navigating by keyboard by then - keeps both;
      //   - a ring is actually there now, so a mouse close, which restores focus without one, is left
      //     alone. That restoration is what this component promises.
      if (!openerHadRing && closedByRequest.current && opener?.matches?.(':focus-visible')) {
        opener.blur?.();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="rsp-modal"
      aria-label={title}
      // Makes the dialog itself eligible for the focus the layout effect gives it.
      tabIndex={-1}
      // Light dismiss, done by the browser: a click outside the box is a close request, exactly as
      // Escape is. That is what removes the need for an onClick that compared event.target with the
      // dialog - the backdrop is a pseudo-element and was never really clickable in the first place.
      closedby="any"
      // Both close requests - Escape and the light dismiss above - fire `cancel` before the browser
      // closes anything. Preventing that default keeps the element controlled by the `open` prop, so a
      // dismissal closes it the same way the buttons do, through the parent, rather than leaving React
      // believing it is still open.
      onCancel={(event) => {
        event.preventDefault();
        closedByRequest.current = true;
        onCancel();
      }}
    >
      <header className="rsp-modal-header">
        <h2 className="rsp-modal-title">{title}</h2>
        <button type="button" className="rsp-modal-close" aria-label="Close" onClick={onCancel}>
          &times;
        </button>
      </header>
      <div className="rsp-modal-content">{children}</div>
      <footer className="rsp-modal-footer">
        <button type="button" className="sbb-btn sbb-btn--secondary" onClick={onCancel}>
          {cancelText}
        </button>
        <button type="button" className="sbb-btn sbb-btn--primary" disabled={okDisabled} onClick={onOk}>
          {okText}
        </button>
      </footer>
    </dialog>
  );
}
