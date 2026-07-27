import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import PropertiesEditor, { tokenizePropertiesLine } from '../src/components/PropertiesEditor';

// Behavior tests for the .properties editor (screenshot-free, so they run on any host). The look -
// token colors and the highlight layer sitting exactly under the text - is covered in
// PropertiesEditor.visual.test.tsx.

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
  const el = document.querySelector<HTMLTextAreaElement>('.properties-editor__input');
  if (!el) throw new Error('editor not rendered');
  return el;
};
const highlight = (): HTMLPreElement => {
  const el = document.querySelector<HTMLPreElement>('.properties-editor__highlight');
  if (!el) throw new Error('highlight layer not rendered');
  return el;
};
const tokenTexts = (kind: string): string[] =>
  Array.from(document.querySelectorAll(`.properties-editor__${kind}`)).map((el) => el.textContent ?? '');

/** Renders the editor as a controlled component whose value is kept in a local variable. */
function renderEditor(
  props: Partial<{
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
  flushSync(() => {
    root!.render(<PropertiesEditor {...props} value={props.value ?? ''} onChange={onChange} />);
  });
  return {
    onChange,
    rerender: (value: string) =>
      flushSync(() => root!.render(<PropertiesEditor {...props} value={value} onChange={onChange} />)),
  };
}

describe('tokenizePropertiesLine', () => {
  it('returns nothing for an empty line', () => {
    expect(tokenizePropertiesLine('')).toEqual([]);
  });

  it.each(['# a hash comment', '! a bang comment', '   # indented'])('treats %s as one comment token', (line) => {
    expect(tokenizePropertiesLine(line)).toEqual([{ kind: 'comment', text: line }]);
  });

  it('splits key, separator and value on =', () => {
    expect(tokenizePropertiesLine('polarion_url=https://example.org')).toEqual([
      { kind: 'key', text: 'polarion_url' },
      { kind: 'separator', text: '=' },
      { kind: 'value', text: 'https://example.org' },
    ]);
  });

  it('splits on a colon and keeps the whitespace around the separator with it', () => {
    expect(tokenizePropertiesLine('key : value')).toEqual([
      { kind: 'key', text: 'key' },
      { kind: 'separator', text: ' : ' },
      { kind: 'value', text: 'value' },
    ]);
  });

  it('does not split on an escaped separator inside the key', () => {
    expect(tokenizePropertiesLine('a\\=b=c')).toEqual([
      { kind: 'key', text: 'a\\=b' },
      { kind: 'separator', text: '=' },
      { kind: 'value', text: 'c' },
    ]);
  });

  it('treats a line without a separator as a bare key (a property being typed)', () => {
    expect(tokenizePropertiesLine('half_typed_key')).toEqual([{ kind: 'key', text: 'half_typed_key' }]);
  });

  it('omits the empty key of a line that starts with the separator', () => {
    expect(tokenizePropertiesLine('=orphan')).toEqual([
      { kind: 'separator', text: '=' },
      { kind: 'value', text: 'orphan' },
    ]);
  });

  it('omits the value of a key with none', () => {
    expect(tokenizePropertiesLine('empty=')).toEqual([
      { kind: 'key', text: 'empty' },
      { kind: 'separator', text: '=' },
    ]);
  });
});

describe('PropertiesEditor', () => {
  it('shows the value in the textarea and highlights it underneath', () => {
    renderEditor({ value: '# comment\nkey=value' });

    expect(textarea().value).toBe('# comment\nkey=value');
    expect(tokenTexts('comment')).toEqual(['# comment']);
    expect(tokenTexts('key')).toEqual(['key']);
    expect(tokenTexts('separator')).toEqual(['=']);
    expect(tokenTexts('value')).toEqual(['value']);
  });

  it('keeps the highlight layer line count in step with the textarea, trailing newline included', () => {
    renderEditor({ value: 'a=1\n\nb=2\n' });

    // One rendered line per visual line of the textarea, and the layer's text is the value plus the
    // single sentinel newline that gives the trailing blank line a line box in the <pre>.
    expect(document.querySelectorAll('.properties-editor__line')).toHaveLength(4);
    expect(highlight().textContent).toBe('a=1\n\nb=2\n\n');
  });

  it('reports every edit through onChange', async () => {
    const { onChange, rerender } = renderEditor({ value: '' });

    await userEvent.fill(textarea(), 'key=value');

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith('key=value');

    // Controlled: the highlight follows only once the parent feeds the new value back in.
    rerender('key=value');
    expect(tokenTexts('value')).toEqual(['value']);
  });

  it('scrolls the highlight layer to follow the textarea', () => {
    // Long enough to overflow in both directions - the layer only follows a scroll that can happen.
    renderEditor({ value: Array.from({ length: 200 }, (_, i) => `key_${i}=${'x'.repeat(300)}`).join('\n') });

    const input = textarea();
    input.scrollTop = 120;
    input.scrollLeft = 40;
    input.dispatchEvent(new Event('scroll', { bubbles: true }));

    expect(highlight().scrollTop).toBe(120);
    expect(highlight().scrollLeft).toBe(40);
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

    const wrapper = document.querySelector('.properties-editor');
    expect(wrapper).toHaveClass('properties-editor', 'fills-page');
  });

  it('has no consumer class on the wrapper when none is given', () => {
    renderEditor({});

    expect(document.querySelector('.properties-editor')!.className).toBe('properties-editor');
  });
});
