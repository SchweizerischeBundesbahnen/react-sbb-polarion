import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import PropertiesEditor from '../src/components/PropertiesEditor';

// Visual-regression states for the .properties editor: the token colors and, more importantly, that the
// highlighted layer sits exactly under the textarea's text (a metric that drifts apart is invisible to
// the behavior tests but obvious in a screenshot). Docker-only - see ConfigurationButtons.visual.test.tsx.
// References live in test/expected/PropertiesEditor/ (npm run test:update:docker).

const SAMPLE = [
  '# vault key for polarion credentials',
  'polarion_user_key=polarionSecretKey',
  '',
  '## Doc PDF generation implementation. Possible options:',
  '## DEFAULT      - polarion PD4ML-based implementation',
  'doc_pdf_generator_impl=DEFAULT',
  'timeout : 30',
].join('\n');

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

function renderEditor(value: string) {
  teardown();
  container = document.createElement('div');
  // Mirror the app: body.sbb-ui carries the control tokens the wrapper's border and focus ring use.
  container.className = 'sbb-ui';
  container.style.width = '700px';
  container.style.height = '200px';
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => {
    root!.render(<PropertiesEditor value={value} onChange={() => {}} />);
  });
}

const editorShot = (name: string) =>
  expect(page.elementLocator(document.querySelector('.properties-editor') as HTMLElement)).toMatchScreenshot(name);

describe.skipIf(!__PIXEL_REFERENCES__)('PropertiesEditor visual states', () => {
  it('highlights comments, keys, separators and values', async () => {
    renderEditor(SAMPLE);
    await editorShot('properties-editor-highlighted');
  });

  it('empty (placeholder-less, just the framed box)', async () => {
    renderEditor('');
    await editorShot('properties-editor-empty');
  });

  it('focused (blue border, caret in the text)', async () => {
    renderEditor(SAMPLE);
    document.querySelector<HTMLTextAreaElement>('.properties-editor__input')!.focus();
    await editorShot('properties-editor-focused');
  });
});
