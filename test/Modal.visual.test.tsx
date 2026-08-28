import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import Modal from '../src/components/Modal';
import { settleBeforeCapture } from './helpers';

// Visual-regression states for the shared Modal. Kept separate from the behavior tests (Docker-only,
// since any toMatchScreenshot file diffs on non-Linux font antialiasing). Rendered with React's
// createRoot + flushSync so the dialog is committed synchronously before the screenshot. We screenshot
// the `.rsp-modal` dialog box (not the full-viewport dark overlay). The dialog is capped at
// min(640px, 100vw-32) wide and 85vh tall with overflow:auto, so it always fits the 1280x720 viewport;
// the size/overflow edge cases (long title, tall/wide content, long button labels) are captured on
// purpose to fixate how the current styling handles them.

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function teardown() {
  if (root) {
    flushSync(() => root!.unmount());
    root = undefined;
  }
  container?.remove();
  container = undefined;
}

afterEach(teardown);

function renderModal(props: { title?: string; okText?: string; cancelText?: string; children?: ReactNode }) {
  teardown();
  container = document.createElement('div');
  // The footer's sbb-btn buttons are token-driven (--sbb-btn-*) with no literal fallback, so they only
  // render styled under a scope that defines the tokens. Real apps mount the modal under body.sbb-ui.
  container.className = 'sbb-ui';
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => {
    root!.render(
      <Modal
        open
        title={props.title ?? 'Export document'}
        okText={props.okText}
        cancelText={props.cancelText}
        onOk={() => {}}
        onCancel={() => {}}
      >
        {props.children ?? <p>Are you sure you want to proceed?</p>}
      </Modal>,
    );
  });
}

const dialogShot = (name: string) =>
  settleBeforeCapture().then(() =>
    expect(page.elementLocator(document.querySelector('.rsp-modal') as HTMLElement)).toMatchScreenshot(name),
  );

const LONG_TITLE =
  'Export document - a deliberately long dialog title that will not fit on one line in the modal header and should wrap or clip';

describe.skipIf(!__PIXEL_REFERENCES__)('Modal visual states', () => {
  it('default', async () => {
    renderModal({});
    await dialogShot('modal-default');
  });

  it('small content', async () => {
    renderModal({ title: 'Confirm', children: <span>Proceed?</span> });
    await dialogShot('modal-small-content');
  });

  it('long title', async () => {
    renderModal({ title: LONG_TITLE });
    await dialogShot('modal-long-title');
  });

  it('tall content (capped height + scroll)', async () => {
    renderModal({
      title: 'Details',
      children: (
        <div>
          {Array.from({ length: 40 }, (_, i) => (
            <p key={i}>Paragraph {i + 1}: some body text that makes the dialog exceed its max height.</p>
          ))}
        </div>
      ),
    });
    await dialogShot('modal-tall-content');
  });

  it('wide content (capped width + overflow)', async () => {
    renderModal({
      title: 'Wide',
      children: <div style={{ width: '900px' }}>A content block far wider than the modal max-width.</div>,
    });
    await dialogShot('modal-wide-content');
  });

  it('long footer button labels (footer overflow)', async () => {
    renderModal({
      title: 'Long buttons',
      okText: 'Export the document right now using the currently selected options',
      cancelText: 'No thanks, close this dialog without exporting',
    });
    await dialogShot('modal-long-buttons');
  });
});
