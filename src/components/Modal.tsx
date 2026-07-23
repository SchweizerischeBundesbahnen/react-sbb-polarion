import { useEffect } from 'react';
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
 * Cancel / primary-OK buttons. Closes on Escape or overlay click. `onOk` does NOT auto-close, so an
 * async handler (e.g. an export) can run and show its own result while the dialog stays open; the
 * caller closes via `onCancel`. Footer buttons use the generic unified button system (`sbb-btn`); its
 * CSS and this component's own styles are bundled in the library's stylesheet.
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
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="rsp-modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="rsp-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
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
      </div>
    </div>
  );
}
