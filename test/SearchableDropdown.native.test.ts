import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import SearchableDropdown from '../src/generic/SearchableDropdown.js';

// Guards an RSP patch to the vendored SearchableDropdown.js: generic hides the wrapped <select> (or the
// editable <input>) by style only, which leaves it in the Tab order and the accessibility tree. A keyboard
// user then meets an invisible stop before the trigger, and a screen reader announces every dropdown twice.

let fixture: HTMLDivElement;

beforeEach(() => {
  fixture = document.createElement('div');
  fixture.className = 'sbb-ui';
  document.body.appendChild(fixture);
});

afterEach(() => {
  fixture.remove();
  document.querySelectorAll('.sd-portal').forEach((el) => el.remove());
});

const select = (): HTMLSelectElement => {
  const el = document.createElement('select');
  el.id = 'native-select';
  el.innerHTML = '<option value="a">A</option><option value="b">B</option>';
  fixture.appendChild(el);
  return el;
};

describe('SearchableDropdown - the wrapped native element (RSP-specific)', () => {
  it('takes the wrapped <select> out of the Tab order and the accessibility tree', () => {
    const el = select();
    const dd = new SearchableDropdown({ element: el, rememberSelection: false });
    expect(el.getAttribute('tabindex')).toBe('-1');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    dd.destroy();
  });

  it('takes the wrapped <input> of an editable dropdown out of both too', () => {
    const input = document.createElement('input');
    input.type = 'text';
    fixture.appendChild(input);
    const dd = new SearchableDropdown({ element: input, editable: true, rememberSelection: false, items: [] });
    expect(input.getAttribute('tabindex')).toBe('-1');
    expect(input.getAttribute('aria-hidden')).toBe('true');
    dd.destroy();
  });

  it('stops once per dropdown when tabbing through', async () => {
    const before = document.createElement('button');
    before.textContent = 'before';
    fixture.appendChild(before);
    const dd = new SearchableDropdown({ element: select(), rememberSelection: false });
    const after = document.createElement('button');
    after.textContent = 'after';
    fixture.appendChild(after);

    before.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(dd.trigger);
    await userEvent.tab();
    expect(document.activeElement).toBe(after);
    dd.destroy();
  });

  it('exposes one combobox, not the native <select> as a second one', async () => {
    const label = document.createElement('label');
    label.htmlFor = 'native-select';
    label.textContent = 'Size:';
    fixture.appendChild(label);
    const dd = new SearchableDropdown({ element: select(), rememberSelection: false });
    expect(page.getByRole('combobox').all()).toHaveLength(1);
    await expect.element(page.elementLocator(fixture)).toMatchAriaInlineSnapshot(`
      - text: "Size:"
      - combobox "Size:": A
    `);
    dd.destroy();
  });

  it('hands the focus to the trigger when a <label for> is clicked', async () => {
    const label = document.createElement('label');
    label.htmlFor = 'native-select';
    label.textContent = 'Size:';
    fixture.appendChild(label);
    const dd = new SearchableDropdown({ element: select(), rememberSelection: false });
    await userEvent.click(label);
    expect(document.activeElement).toBe(dd.trigger);
    dd.destroy();
  });

  it('hands the focus to the trigger when the text of a wrapping <label> is clicked', async () => {
    const label = document.createElement('label');
    label.innerHTML = '<span>Size:</span><select><option value="a">A</option></select>';
    fixture.appendChild(label);
    const dd = new SearchableDropdown({ element: label.querySelector('select')!, rememberSelection: false });
    await userEvent.click(label.querySelector('span')!);
    expect(document.activeElement).toBe(dd.trigger);
    dd.destroy();
  });

  it('hands the focus to the trigger when a consumer focuses the <select>', () => {
    const el = select();
    const dd = new SearchableDropdown({ element: el, rememberSelection: false });
    el.focus();
    expect(document.activeElement).toBe(dd.trigger);
    dd.destroy();
  });

  it('puts back the attributes the element had, and drops the ones it did not, on destroy()', () => {
    const el = select();
    el.setAttribute('tabindex', '3');
    const dd = new SearchableDropdown({ element: el, rememberSelection: false });
    dd.destroy();
    expect(el.getAttribute('tabindex')).toBe('3');
    expect(el.hasAttribute('aria-hidden')).toBe(false);
    el.focus();
    expect(document.activeElement).toBe(el);
  });
});
