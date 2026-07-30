import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import CodeEditor, { type CodeLanguage } from '../src/components/CodeEditor';
import { parkPointer } from './helpers';

// Visual-regression states for the code editor: the token colors of every supported grammar and, more
// importantly, that the highlighted layer sits exactly under the textarea's text (a metric that drifts
// apart is invisible to the behavior tests but obvious in a screenshot). Docker-only - see
// ConfigurationButtons.visual.test.tsx. References live in test/expected/CodeEditor/
// (npm run test:update:docker).
//
// One reference per language, because the theme is the point: each sample is written to reach the token
// types that language actually produces on the pages being migrated, so a mis-scoped or dropped color
// rule shows up as a diff instead of passing unnoticed.

const PROPERTIES = [
  '# vault key for polarion credentials',
  'polarion_user_key=polarionSecretKey',
  '',
  '## Doc PDF generation implementation. Possible options:',
  '## DEFAULT      - polarion PD4ML-based implementation',
  'doc_pdf_generator_impl=DEFAULT',
  'timeout : 30',
].join('\n');

// Shaped after the exporters' default stylesheet: at-rule, selectors, properties, a color, !important.
const CSS = [
  '/* cover page overrides */',
  '@media print {',
  '  .cover h1, .cover h2 {',
  '    color: #0079c7;',
  '    font-size: 24px !important;',
  '    background: url("logo.png");',
  '  }',
  '}',
].join('\n');

// Shaped after a header/footer cell template: comment, nested tags, attributes, an entity.
const HTML = [
  '<!-- header, left cell -->',
  '<div class="header" id="top-left">',
  '  <span style="font-weight: bold">Document&nbsp;title</span>',
  '  <img src="logo.png" alt="SBB"/>',
  '</div>',
].join('\n');

// Shaped after a filename template and a cover page: Velocity comment, directives with operators and
// numbers, plain and braced variables - all of it inside markup.
const VELOCITY = [
  '#* file name of the exported document *#',
  '#set($name = ${document.id})',
  '#if($document.revision != 0)',
  '  <span class="rev">$name - r${document.revision}</span>',
  '#else',
  '  <span class="rev">$name.toLowerCase()</span>',
  '#end',
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

function renderEditor(language: CodeLanguage, value: string) {
  teardown();
  container = document.createElement('div');
  // Mirror the app: body.sbb-ui carries the control tokens the wrapper's border and focus ring use.
  container.className = 'sbb-ui';
  container.style.width = '700px';
  container.style.height = '200px';
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => {
    root!.render(<CodeEditor language={language} value={value} onChange={() => {}} />);
  });
}

const editorShot = (name: string) =>
  parkPointer().then(() =>
    expect(page.elementLocator(document.querySelector('.code-editor') as HTMLElement)).toMatchScreenshot(name),
  );

describe.skipIf(!__PIXEL_REFERENCES__)('CodeEditor visual states', () => {
  it('highlights a .properties document', async () => {
    renderEditor('properties', PROPERTIES);
    await editorShot('code-editor-properties');
  });

  it('highlights a stylesheet', async () => {
    renderEditor('css', CSS);
    await editorShot('code-editor-css');
  });

  it('highlights an HTML fragment', async () => {
    renderEditor('html', HTML);
    await editorShot('code-editor-html');
  });

  it('highlights a Velocity template inside markup', async () => {
    renderEditor('velocity', VELOCITY);
    await editorShot('code-editor-velocity');
  });

  it('empty (placeholder-less, just the framed box)', async () => {
    renderEditor('properties', '');
    await editorShot('code-editor-empty');
  });

  it('focused (blue border, caret in the text)', async () => {
    renderEditor('properties', PROPERTIES);
    document.querySelector<HTMLTextAreaElement>('.code-editor__input')!.focus();
    await editorShot('code-editor-focused');
  });
});
