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

  // showModal() is what makes it modal; the `open` attribute alone renders a non-modal dialog with no
  // backdrop and no focus handling, so this cannot be expressed declaratively in the JSX.
  //
  // Layout, not passive: a <dialog> that has not been shown is display:none, so a passive effect would
  // leave it mounted-but-invisible until after paint. Opening it in the commit phase keeps "mounted"
  // and "shown" the same instant - no frame in which the dialog exists without its backdrop.
  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    // The dialog focusing steps land on the first focusable descendant, which here is the close button
    // - so Enter, pressed straight after opening, would dismiss the dialog. Focus the dialog itself
    // instead: nothing is armed, and a screen reader announces the dialog by its title. Done here
    // rather than with `autoFocus`, because React does not render that as the attribute the focusing
    // steps read; it focuses the node itself, which is not the same thing for a <dialog>.
    dialog?.focus();
    return () => dialog?.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="rsp-modal"
      aria-label={title}
      // Makes the dialog itself eligible for the focus the layout effect gives it.
      tabIndex={-1}
      // Escape fires `cancel` before the browser closes the dialog. Preventing that default keeps the
      // element controlled by the `open` prop, so Escape closes it the same way the buttons do -
      // through the parent - rather than leaving React believing it is still open.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      // A click on the backdrop is reported with the dialog itself as the target. The box has no
      // padding, so anything clicked inside the content hits a child and never matches this.
      onClick={(event) => {
        if (event.target === dialogRef.current) onCancel();
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
