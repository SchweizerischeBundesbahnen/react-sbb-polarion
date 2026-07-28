import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Modal from '../components/Modal';

export interface ConfirmOptions {
  /** Dialog heading. Defaults to "Confirm". */
  title?: string;
  /** Label of the confirming button. Defaults to "OK". */
  okText?: string;
  cancelText?: string;
}

export interface UseConfirm {
  /** Ask the question; resolves true if the user confirmed, false on cancel, Escape or overlay click. */
  confirm: (message: ReactNode, options?: ConfirmOptions) => Promise<boolean>;
  /** Render this somewhere in the page - it is the dialog itself, and renders nothing while idle. */
  confirmDialog: ReactNode;
}

/**
 * `window.confirm` as a real dialog, styled like everything else on the page.
 *
 * The browser's own dialog is jarring in a Polarion admin page: it is chrome-coloured, says
 * "localhost says", and cannot be styled - so it reads as though the site broke rather than as though
 * it asked a question. It also blocks the renderer thread while open.
 *
 * The shape is deliberately promise-based so a call site reads almost exactly as it did before:
 *
 * ```tsx
 * const { confirm, confirmDialog } = useConfirm();
 * if (!(await confirm('Are you sure you want to return the default value?'))) return;
 * …
 * return (<PageLayout>{…}{confirmDialog}</PageLayout>);
 * ```
 */
export default function useConfirm(): UseConfirm {
  const [request, setRequest] = useState<{ message: ReactNode; options: ConfirmOptions } | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setRequest(null);
  }, []);

  // A pending question whose page goes away would otherwise leave its caller awaiting forever.
  useEffect(() => () => resolveRef.current?.(false), []);

  const confirm = useCallback((message: ReactNode, options: ConfirmOptions = {}) => {
    // A second question while one is open would strand the first caller; answer that one "no" first.
    resolveRef.current?.(false);
    setRequest({ message, options });
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const confirmDialog = request ? (
    <Modal
      open
      title={request.options.title ?? 'Confirm'}
      okText={request.options.okText ?? 'OK'}
      cancelText={request.options.cancelText ?? 'Cancel'}
      onOk={() => settle(true)}
      onCancel={() => settle(false)}
    >
      <p className="rsp-confirm-message">{request.message}</p>
    </Modal>
  ) : null;

  return { confirm, confirmDialog };
}
