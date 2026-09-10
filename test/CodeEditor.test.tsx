import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import CodeEditor, { type CodeLanguage, renderNode } from '../src/components/CodeEditor';

// Behavior tests for the code editor (screenshot-free, so they run on any host). The look - token
// colors and the highlight layer sitting exactly under the text - is covered in
// CodeEditor.visual.test.tsx.
//
// The token assertions name prism's own class names, because the component renders refractor's tree
// verbatim. They are behavior, not implementation detail: which class a run of text lands in is exactly
// what decides its color, and it is the contract CodeEditor.css styles against.

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

const textarea = (): HTMLTextAreaElement => {
  const el = document.querySelector<HTMLTextAreaElement>('.code-editor__input');
  if (!el) throw new Error('editor not rendered');
  return el;
};
const highlight = (): HTMLPreElement => {
  const el = document.querySelector<HTMLPreElement>('.code-editor__highlight');
  if (!el) throw new Error('highlight layer not rendered');
  return el;
};
/** The highlight layer's `<code>` - the element the component translates to follow the textarea. */
const highlightContent = (): HTMLElement => {
  const el = highlight().querySelector('code');
  if (!el) throw new Error('highlight layer has no content');
  return el;
};
/** Texts of the outermost tokens of one prism type - nested ones are skipped, so `<div ...>` counts once. */
const tokenTexts = (type: string): string[] =>
  Array.from(document.querySelectorAll<HTMLElement>(`.code-editor__highlight .token.${type}`))
    .filter((el) => !el.parentElement?.classList.contains(type))
    .map((el) => el.textContent ?? '');

/** Renders the editor as a controlled component whose value is kept in a local variable. */
function renderEditor(
  props: Partial<{
    language: CodeLanguage;
    value: string;
    onChange: (value: string) => void;
    id: string;
    ariaLabel: string;
    placeholder: string;
    readOnly: boolean;
    className: string;
  }> = {},
) {
  teardown();
  container = document.createElement('div');
  container.className = 'sbb-ui';
  container.style.width = '600px';
  document.body.appendChild(container);
  root = createRoot(container);
  const onChange = props.onChange ?? vi.fn();
  const language = props.language ?? 'properties';
  flushSync(() => {
    root!.render(<CodeEditor {...props} language={language} value={props.value ?? ''} onChange={onChange} />);
  });
  return {
    onChange,
    rerender: (value: string, nextLanguage: CodeLanguage = language) =>
      flushSync(() =>
        root!.render(<CodeEditor {...props} language={nextLanguage} value={value} onChange={onChange} />),
      ),
  };
}

describe('renderNode', () => {
  // Driven directly, because refractor's own tree never takes these two paths - it holds nothing but
  // text and `<span>`s whose className is a list. hast's node and property types are wider than that,
  // so the narrowing has to be there; these cases pin down what it does with the rest instead of
  // leaving it to be discovered by a blank editor one day.
  const renderToDom = (node: Parameters<typeof renderNode>[0]): string => {
    teardown();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    flushSync(() => root!.render(<>{renderNode(node, 0)}</>));
    return container.innerHTML;
  };

  it('renders a text node as its text', () => {
    expect(renderToDom({ type: 'text', value: 'key=value' })).toBe('key=value');
  });

  it('renders an element as a span carrying its class names', () => {
    expect(
      renderToDom({
        type: 'element',
        tagName: 'span',
        properties: { className: ['token', 'comment'] },
        children: [{ type: 'text', value: '# c' }],
      }),
    ).toBe('<span class="token comment"># c</span>');
  });

  it('renders an element whose class names are missing as an unclassed span', () => {
    expect(
      renderToDom({
        type: 'element',
        tagName: 'span',
        properties: {},
        children: [{ type: 'text', value: 'plain' }],
      }),
    ).toBe('<span>plain</span>');
  });

  it('drops a node that is neither text nor an element', () => {
    // A hast comment: representable by the type, never produced by prism. Dropped, not rendered as
    // text - a stray "<!-- -->" in the highlight layer would push every glyph after it out of line.
    expect(renderToDom({ type: 'comment', value: 'not from prism' })).toBe('');
  });
});

describe('CodeEditor languages', () => {
  it('highlights a .properties document as comment, key, separator and value', () => {
    renderEditor({ language: 'properties', value: '# comment\nkey=value\ntimeout : 30' });

    expect(tokenTexts('comment')).toEqual(['# comment']);
    expect(tokenTexts('attr-name')).toEqual(['key', 'timeout']);
    expect(tokenTexts('attr-value')).toEqual(['value', '30']);
    expect(tokenTexts('punctuation')).toEqual(['=', ':']);
  });

  it('highlights CSS as selectors, properties and at-rules', () => {
    renderEditor({
      language: 'css',
      value: '/* c */\n.cover h1 { color: red }\n@media print { .cover { display: none } }',
    });

    expect(tokenTexts('comment')).toEqual(['/* c */']);
    expect(tokenTexts('selector')).toEqual(['.cover h1', '.cover']);
    expect(tokenTexts('property')).toEqual(['color', 'display']);
    expect(tokenTexts('atrule')).toEqual(['@media print']);
  });

  it('highlights HTML as tags, attributes and comments', () => {
    renderEditor({ language: 'html', value: '<!-- c -->\n<div class="cover">text</div>' });

    expect(tokenTexts('comment')).toEqual(['<!-- c -->']);
    expect(tokenTexts('tag')).toEqual(['<div class="cover">', '</div>']);
    expect(tokenTexts('attr-name')).toEqual(['class']);
    expect(tokenTexts('attr-value')).toEqual(['="cover"']);
  });

  it('highlights Velocity directives, variables and its own comment syntax', () => {
    renderEditor({ language: 'velocity', value: '#* c *#\n#if($doc.title)\n${revision}\n#end' });

    // The #* *# comment carries prism's `comment` alias, so it is themed like any other comment.
    expect(tokenTexts('comment')).toEqual(['#* c *#']);
    expect(tokenTexts('keyword')).toEqual(['#if', '#end']);
    expect(tokenTexts('variable')).toEqual(['$doc.title', '${revision}']);
  });

  it('treats markup as markup in the velocity grammar too - the templates are HTML with variables in it', () => {
    // Same source, two languages: the one distinction that makes a separate `html+velocity` value
    // unnecessary. `velocity` is the markup grammar extended, so it highlights both.
    renderEditor({ language: 'html', value: '<b>$doc.id</b>' });
    expect(tokenTexts('tag')).toEqual(['<b>', '</b>']);
    expect(tokenTexts('variable')).toEqual([]);

    renderEditor({ language: 'velocity', value: '<b>$doc.id</b>' });
    expect(tokenTexts('tag')).toEqual(['<b>', '</b>']);
    expect(tokenTexts('variable')).toEqual(['$doc.id']);
  });

  it('re-highlights the same document when only the language changes', () => {
    const { rerender } = renderEditor({ language: 'html', value: '<b>$doc.id</b>' });
    expect(tokenTexts('variable')).toEqual([]);

    // Guards the memo key: highlighting is cached, and caching it on the value alone would leave the
    // markup-only tokens in place here.
    rerender('<b>$doc.id</b>', 'velocity');
    expect(tokenTexts('variable')).toEqual(['$doc.id']);
  });

  it('keeps a token that spans newlines in one piece', () => {
    // Why the highlight layer is not split into one element per line: this comment is a single token.
    renderEditor({ language: 'css', value: '/* two\n   lines */\n.a { color: red }' });

    expect(tokenTexts('comment')).toEqual(['/* two\n   lines */']);
  });
});

describe('CodeEditor', () => {
  it('shows the value in the textarea and highlights it underneath', () => {
    renderEditor({ value: '# comment\nkey=value' });

    expect(textarea().value).toBe('# comment\nkey=value');
    expect(tokenTexts('comment')).toEqual(['# comment']);
    expect(tokenTexts('attr-value')).toEqual(['value']);
  });

  it('paints the layer text as the value plus the single sentinel newline', () => {
    renderEditor({ value: 'a=1\n\nb=2\n' });

    // The sentinel gives the trailing blank line a line box in the <pre>, so the two layers keep the
    // same height; without it they drift apart by one line.
    expect(highlight().textContent).toBe('a=1\n\nb=2\n\n');
  });

  it('renders an empty document as just the sentinel', () => {
    renderEditor({ value: '' });

    expect(highlight().textContent).toBe('\n');
  });

  it('reports every edit through onChange', async () => {
    const { onChange, rerender } = renderEditor({ value: '' });

    await userEvent.fill(textarea(), 'key=value');

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith('key=value');

    // Controlled: the highlight follows only once the parent feeds the new value back in.
    rerender('key=value');
    expect(tokenTexts('attr-value')).toEqual(['value']);
  });

  it('translates the highlight layer to follow the textarea', () => {
    // Long enough to overflow in both directions - the layer only follows a scroll that can happen.
    renderEditor({ value: Array.from({ length: 200 }, (_, i) => `key_${i}=${'x'.repeat(300)}`).join('\n') });

    const input = textarea();
    input.scrollTop = 120;
    input.scrollLeft = 40;
    input.dispatchEvent(new Event('scroll', { bubbles: true }));

    expect(highlightContent().style.transform).toBe('translate(-40px, -120px)');
  });

  it('keeps the layers aligned at the end of the scroll range when the scrollbars take space', () => {
    // The regression this guards: the layer used to follow by `scrollTop`/`scrollLeft`, which the
    // browser clamps to the layer's own shorter range - the textarea's range is longer, because its
    // visible scrollbars take space out of its client box while the overflow-hidden layer keeps the
    // whole box. Scrolled to the end, the code was then painted about a line away from the caret.
    // The scrollbars are faked with transparent borders, because this browser has only overlay
    // scrollbars, which take no space at all and so cannot show the bug. A space-taking scrollbar is
    // exactly what the borders below are: 15px of the client box gone at the bottom and right edge,
    // the top left corner where the text starts untouched.
    const scrollbarStyles = document.createElement('style');
    scrollbarStyles.textContent =
      '.code-editor__input { border-bottom: 15px solid transparent; border-right: 15px solid transparent }';
    document.head.appendChild(scrollbarStyles);
    try {
      renderEditor({ value: Array.from({ length: 200 }, (_, i) => `key_${i}=${'x'.repeat(300)}`).join('\n') });

      const input = textarea();
      // Both scrollbars take their space, and the user is at the very bottom and the far right.
      expect(input.clientHeight).toBeLessThan(highlight().clientHeight);
      expect(input.clientWidth).toBeLessThan(highlight().clientWidth);
      input.scrollTop = input.scrollHeight;
      input.scrollLeft = input.scrollWidth;
      input.dispatchEvent(new Event('scroll', { bubbles: true }));

      // Where the layer paints its first line, against where the textarea holds its own text: the
      // padded top left corner of the shared box, moved by the scroll offsets.
      const box = input.getBoundingClientRect();
      const styles = getComputedStyle(input);
      const painted = highlightContent().getBoundingClientRect();
      expect(Math.round(painted.top)).toBe(Math.round(box.top + parseFloat(styles.paddingTop) - input.scrollTop));
      expect(Math.round(painted.left)).toBe(Math.round(box.left + parseFloat(styles.paddingLeft) - input.scrollLeft));
    } finally {
      scrollbarStyles.remove();
    }
  });

  it("keeps the highlight layer's metrics when the app styles bare <code> for inline code", () => {
    const appStyles = document.createElement('style');
    // What a consuming app's App.css declares for inline code in its prose.
    appStyles.textContent = 'code { font-size: 0.9em; border: 1px solid #ccc; padding: 0 3px; background: #f4f5f7 }';
    document.head.appendChild(appStyles);
    try {
      renderEditor({ value: 'key=value' });

      const code = getComputedStyle(highlight().querySelector('code')!);
      expect(code.fontSize).toBe(getComputedStyle(textarea()).fontSize);
      expect(code.borderTopWidth).toBe('0px');
      expect(code.paddingLeft).toBe('0px');
    } finally {
      appStyles.remove();
    }
  });

  it('hides the highlight layer from assistive technology and from the pointer', () => {
    renderEditor({ value: 'key=value' });

    expect(highlight()).toHaveAttribute('aria-hidden', 'true');
    expect(getComputedStyle(highlight()).pointerEvents).toBe('none');
  });

  it('passes id, aria-label, placeholder and readOnly to the textarea', () => {
    renderEditor({ id: 'properties-input', ariaLabel: 'Configuration', placeholder: 'key=value', readOnly: true });

    const input = textarea();
    expect(input).toHaveAttribute('id', 'properties-input');
    expect(input).toHaveAttribute('aria-label', 'Configuration');
    expect(input).toHaveAttribute('placeholder', 'key=value');
    expect(input).toHaveAttribute('readonly');
    expect(input.spellcheck).toBe(false);
  });

  it('appends the consumer class to the wrapper and keeps the base class', () => {
    renderEditor({ className: 'fills-page' });

    const wrapper = document.querySelector('.code-editor');
    expect(wrapper).toHaveClass('code-editor', 'fills-page');
  });

  it('has no consumer class on the wrapper when none is given', () => {
    renderEditor({});

    expect(document.querySelector('.code-editor')!.className).toBe('code-editor');
  });
});
