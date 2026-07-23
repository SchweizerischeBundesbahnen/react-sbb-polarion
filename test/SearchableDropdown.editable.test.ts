import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchableDropdown from '../src/generic/SearchableDropdown.js';
import { keydown } from './helpers';

// Editable (free-text) mode of the vendored class - used by ColumnInput-style comboboxes via
// createEditableSelect. Ported behavior-level from generic's suite, driving real events on the trigger
// (focus / input / keydown / blur). Three generic tests that assert the private `_open()`/`_handleEnter()`
// highlight internals (pre-highlight against the filtered list, Enter-on-highlight/no-highlight while
// open) are not ported - the observable commit paths are covered by the focus/keyboard/blur tests below.

let fixture: HTMLDivElement;

beforeEach(() => {
  fixture = document.createElement('div');
  fixture.innerHTML = '<div id="build-container"></div>';
  document.body.appendChild(fixture);
});

afterEach(() => {
  fixture.remove();
  document.querySelectorAll('.sd-portal').forEach((el) => el.remove());
});

const editableInput = (initial?: string): HTMLInputElement => {
  const input = document.createElement('input');
  input.type = 'text';
  if (initial !== undefined) input.value = initial;
  fixture.appendChild(input);
  return input;
};
const fire = (node: Element, type: string) => node.dispatchEvent(new Event(type));

describe('SearchableDropdown - editable (free-text) mode', () => {
  it('has an editable trigger (no search box) and seeds from the wrapped input value', () => {
    const dd = new SearchableDropdown({
      element: editableInput('42'),
      editable: true,
      rememberSelection: false,
      items: [
        { value: '1', label: 'One' },
        { value: '2', label: 'Two' },
      ],
    });
    expect(dd.editable).toBe(true);
    expect(dd.trigger.readOnly).toBe(false);
    expect(dd.searchInput).toBeUndefined();
    expect(dd.trigger.value).toBe('42');
    expect(dd.container.classList.contains('editable')).toBe(true);
    dd.destroy();
  });

  it('focus opens the full list', () => {
    const dd = new SearchableDropdown({
      element: editableInput(''),
      editable: true,
      rememberSelection: false,
      items: [
        { value: '1', label: 'One' },
        { value: '2', label: 'Two' },
      ],
    });
    fire(dd.trigger, 'focus');
    expect(dd.isOpen).toBe(true);
    expect(dd.itemsEl.children.length).toBe(2);
    dd.destroy();
  });

  it('focus on a field that already holds a value does not open the popup', () => {
    const dd = new SearchableDropdown({
      element: editableInput('A'),
      editable: true,
      rememberSelection: false,
      items: [
        { value: 'A', label: 'A' },
        { value: 'B', label: 'B' },
      ],
    });
    fire(dd.trigger, 'focus');
    expect(dd.isOpen).toBe(false);
    dd.destroy();
  });

  it('typing sanitises via inputFilter and filters the list', () => {
    const dd = new SearchableDropdown({
      element: editableInput(''),
      editable: true,
      rememberSelection: false,
      inputFilter: (v: string) => v.replace(/\D/g, ''),
      items: [
        { value: '10', label: '10 ten' },
        { value: '22', label: '22 two' },
      ],
    });
    dd.trigger.value = '1a0';
    fire(dd.trigger, 'input');
    expect(dd.trigger.value).toBe('10');
    expect(dd.isOpen).toBe(true);
    expect(dd.itemsEl.children.length).toBe(1);
    dd.destroy();
  });

  it('typing without an inputFilter still filters', () => {
    const dd = new SearchableDropdown({
      element: editableInput(''),
      editable: true,
      rememberSelection: false,
      items: [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
      ],
    });
    dd.trigger.value = 'ban';
    fire(dd.trigger, 'input');
    expect(dd.trigger.value).toBe('ban');
    expect(dd.itemsEl.children.length).toBe(1);
    dd.destroy();
  });

  it('typing a value matching no suggestion closes the popup (no "No matches" box)', () => {
    const az = Array.from({ length: 26 }, (_, i) => {
      const l = String.fromCharCode(65 + i);
      return { value: l, label: l };
    });
    const dd = new SearchableDropdown({
      element: editableInput(''),
      editable: true,
      rememberSelection: false,
      inputFilter: (v: string) => v.replace(/[^A-Za-z]/g, '').toUpperCase(),
      items: az,
    });
    dd.trigger.value = 'A';
    fire(dd.trigger, 'input');
    expect(dd.isOpen).toBe(true);
    expect(dd.itemsEl.children.length).toBe(1);
    dd.trigger.value = 'AA';
    fire(dd.trigger, 'input');
    expect(dd.isOpen).toBe(false);
    expect(dd.itemsEl.querySelector('.sd-empty')).toBeNull();
    dd.destroy();
  });

  it('syncFromElement mirrors the wrapped input value verbatim (free text, not label)', () => {
    const input = editableInput('');
    const dd = new SearchableDropdown({
      element: input,
      editable: true,
      rememberSelection: false,
      items: [{ value: 'A', label: 'Alpha' }],
    });
    input.value = 'ZZ';
    dd.syncFromElement();
    expect(dd.trigger.value).toBe('ZZ');
    input.value = 'A';
    dd.syncFromElement();
    expect(dd.trigger.value).toBe('A'); // raw value, not the label "Alpha"
    input.value = '';
    dd.syncFromElement();
    expect(dd.trigger.value).toBe('');
    dd.destroy();
  });

  it('the value setter mirrors onto the wrapped input', () => {
    const input = editableInput('');
    const dd = new SearchableDropdown({
      element: input,
      editable: true,
      rememberSelection: false,
      items: [{ value: 'A', label: 'A' }],
    });
    dd.value = 'ZZ';
    expect(dd.trigger.value).toBe('ZZ');
    expect(input.value).toBe('ZZ');
    dd.destroy();
  });

  it('selecting an option commits its value (not label), mirrors onto the input, and fires change', () => {
    const input = editableInput('');
    const onChange = vi.fn();
    input.addEventListener('change', onChange);
    const dd = new SearchableDropdown({
      element: input,
      editable: true,
      rememberSelection: false,
      items: [{ value: '12345', label: '12345 revision' }],
    });
    dd.selectItem(dd.items[0]);
    expect(dd.trigger.value).toBe('12345');
    expect(input.value).toBe('12345');
    expect(onChange).toHaveBeenCalledTimes(1);
    dd.destroy();
  });

  it('ArrowDown + Enter selects the highlighted option', () => {
    const input = editableInput('');
    const dd = new SearchableDropdown({
      element: input,
      editable: true,
      rememberSelection: false,
      items: [{ value: 'x', label: 'X' }],
    });
    fire(dd.trigger, 'focus'); // opens the full list
    keydown(dd.trigger, 'ArrowDown');
    keydown(dd.trigger, 'Enter');
    expect(input.value).toBe('x');
    dd.destroy();
  });

  it('Enter commits the free text while the popup is closed (no matches), preventing default', () => {
    const input = editableInput('');
    const onChange = vi.fn();
    input.addEventListener('change', onChange);
    const dd = new SearchableDropdown({
      element: input,
      editable: true,
      rememberSelection: false,
      items: [{ value: 'A', label: 'A' }],
    });
    dd.trigger.value = 'ZZ';
    fire(dd.trigger, 'input');
    expect(dd.isOpen).toBe(false);
    const evt = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
    dd.trigger.dispatchEvent(evt);
    expect(input.value).toBe('ZZ');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(evt.defaultPrevented).toBe(true);
    dd.destroy();
  });

  it('blur commits the free text once; a second blur with no change does nothing', () => {
    const input = editableInput('');
    const onChange = vi.fn();
    input.addEventListener('change', onChange);
    const dd = new SearchableDropdown({ element: input, editable: true, rememberSelection: false, items: [] });
    dd.trigger.value = 'abc';
    fire(dd.trigger, 'blur');
    expect(input.value).toBe('abc');
    expect(onChange).toHaveBeenCalledTimes(1);
    fire(dd.trigger, 'blur');
    expect(onChange).toHaveBeenCalledTimes(1);
    dd.destroy();
  });

  it('selectItem(null) clears the editable field and the wrapped input', () => {
    const input = editableInput('');
    const dd = new SearchableDropdown({
      element: input,
      editable: true,
      rememberSelection: false,
      items: [{ value: '7', label: 'Seven' }],
    });
    dd.selectItem(dd.items[0]);
    expect(input.value).toBe('7');
    dd.selectItem(null);
    expect(dd.trigger.value).toBe('');
    expect(input.value).toBe('');
    dd.destroy();
  });

  it('build-mode editable has no wrapped <input> - blur is a no-op', () => {
    const dd = new SearchableDropdown({
      selectContainer: document.getElementById('build-container')!,
      editable: true,
      rememberSelection: false,
    });
    dd.addOption('a', 'Apple');
    expect(dd.originalElement).toBeNull();
    dd.trigger.value = 'free';
    expect(() => fire(dd.trigger, 'blur')).not.toThrow();
    dd.destroy();
  });
});
