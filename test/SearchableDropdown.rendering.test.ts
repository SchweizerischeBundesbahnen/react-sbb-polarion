import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SearchableDropdown from '../src/generic/SearchableDropdown.js';
import { mousedown } from './helpers';

// Vanilla-class rendering & interaction behaviors (icons, chips, mouse, label resolution, change
// listener, clearable ×, refresh/sync) ported behavior-level from generic's suite. Where generic called
// the private `_renderOptions(items)` to populate the list, we open the popup for real (mousedown the
// trigger) instead. The portal-positioning tests (overflow-shift / dropup / reposition) are NOT ported:
// they mock a private `_position()` with hardcoded geometry - appearance is covered by visual regression.

let fixture: HTMLDivElement;

beforeEach(() => {
  fixture = document.createElement('div');
  fixture.innerHTML = `
    <div id="build-container"></div>
    <select id="single">
      <option value="a">A</option>
      <option value="b">B</option>
      <option value="c" disabled>C</option>
    </select>
    <select id="multi" multiple>
      <option value="a">A</option>
      <option value="b">B</option>
      <option value="c">C</option>
    </select>`;
  document.body.appendChild(fixture);
});

afterEach(() => {
  fixture.remove();
  document.querySelectorAll('.sd-portal').forEach((el) => el.remove());
});

const buildContainer = () => document.getElementById('build-container')!;
const single = () => document.getElementById('single') as HTMLSelectElement;
const multi = () => document.getElementById('multi') as HTMLSelectElement;
const itemByValue = (d: SearchableDropdown, value: string) => d.items.find((i: { value: string }) => i.value === value);
const iconSelect = (): HTMLSelectElement => {
  const select = document.createElement('select');
  select.innerHTML = '<option value="a" data-icon="/i/a.svg">A</option><option value="b">B</option>';
  fixture.appendChild(select);
  return select;
};

describe('option rendering: icons, classes, mouse', () => {
  it('overlays the selected option icon on a single-select trigger', () => {
    const dropdown = new SearchableDropdown({ element: iconSelect(), rememberSelection: false });
    expect(dropdown.triggerIcon.getAttribute('src')).toBe('/i/a.svg');
    expect(dropdown.trigger.classList.contains('has-icon')).toBe(true);
    dropdown.destroy();
  });

  it('renders an option-icon and has-icon class for single-select options', () => {
    const dropdown = new SearchableDropdown({ element: iconSelect(), rememberSelection: false });
    mousedown(dropdown.trigger);
    const first = dropdown.itemsEl.children[0] as HTMLElement;
    expect(first.classList.contains('has-icon')).toBe(true);
    expect(first.querySelector('img.option-icon')?.getAttribute('src')).toBe('/i/a.svg');
    dropdown.destroy();
  });

  it('renders icons and checkboxes inside multi-select options', () => {
    const dropdown = new SearchableDropdown({
      selectContainer: buildContainer(),
      multiselect: true,
      rememberSelection: false,
    });
    dropdown.addOption('a', 'A', '/i/a.svg');
    mousedown(dropdown.trigger);
    const opt = dropdown.itemsEl.children[0] as HTMLElement;
    expect(opt.classList.contains('multiselect-option')).toBe(true);
    expect(opt.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(opt.querySelector('img.option-icon')?.getAttribute('src')).toBe('/i/a.svg');
    dropdown.destroy();
  });

  it('applies an icon background tile from data-icon-bg (element mode)', () => {
    const select = document.createElement('select');
    select.innerHTML =
      '<option value="a" data-icon="/i/a.svg" data-icon-bg="#1a3a5c">A</option><option value="b" data-icon="/i/b.svg">B</option>';
    fixture.appendChild(select);
    const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
    expect(dropdown.triggerIcon.classList.contains('has-icon-bg')).toBe(true);
    expect(dropdown.triggerIcon.style.backgroundColor).not.toBe('');
    mousedown(dropdown.trigger);
    const iconA = dropdown.itemsEl.children[0].querySelector('img.option-icon') as HTMLElement;
    const iconB = dropdown.itemsEl.children[1].querySelector('img.option-icon') as HTMLElement;
    expect(iconA.classList.contains('has-icon-bg')).toBe(true);
    expect(iconB.classList.contains('has-icon-bg')).toBe(false);
    dropdown.destroy();
  });

  it('accepts an icon background as the 4th addOption argument (build mode)', () => {
    const dropdown = new SearchableDropdown({ selectContainer: buildContainer(), rememberSelection: false });
    dropdown.addOption('a', 'A', '/i/a.svg', '#1a3a5c');
    dropdown.addOption('b', 'B', '/i/b.svg');
    mousedown(dropdown.trigger);
    const iconA = dropdown.itemsEl.children[0].querySelector('img.option-icon') as HTMLElement;
    const iconB = dropdown.itemsEl.children[1].querySelector('img.option-icon') as HTMLElement;
    expect(iconA.classList.contains('has-icon-bg')).toBe(true);
    expect(iconB.classList.contains('has-icon-bg')).toBe(false);
    dropdown.destroy();
  });

  it('mirrors an option CSS class onto the rendered option when preserveOptionClasses', () => {
    const select = document.createElement('select');
    select.innerHTML = '<option value="a" class="parent">A</option>';
    fixture.appendChild(select);
    const dropdown = new SearchableDropdown({ element: select, preserveOptionClasses: true, rememberSelection: false });
    mousedown(dropdown.trigger);
    expect((dropdown.itemsEl.children[0] as HTMLElement).classList.contains('parent')).toBe(true);
    dropdown.destroy();
  });

  it('highlights on mouseover and selects on option mousedown', () => {
    const dropdown = new SearchableDropdown({ element: single(), rememberSelection: false });
    mousedown(dropdown.trigger);
    const bOption = dropdown.itemsEl.children[1] as HTMLElement;
    bOption.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(bOption.classList.contains('active')).toBe(true);
    mousedown(bOption);
    expect(dropdown.getSelectedValue()).toBe('b');
    dropdown.destroy();
  });
});

describe('label text resolution', () => {
  it('prefers the passed label element text for aria-label', () => {
    const label = document.createElement('label');
    label.textContent = '  Colour  ';
    const dropdown = new SearchableDropdown({ selectContainer: buildContainer(), label, rememberSelection: false });
    expect(dropdown.trigger.getAttribute('aria-label')).toBe('Colour');
    dropdown.destroy();
  });

  it('falls back to the <select> aria-label attribute', () => {
    const select = single();
    select.setAttribute('aria-label', 'Sizes');
    const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
    expect(dropdown.trigger.getAttribute('aria-label')).toBe('Sizes');
    dropdown.destroy();
  });

  it('ignores an id that is not usable as a CSS selector (no crash, no aria-label)', () => {
    const select = document.createElement('select');
    select.id = 'bad"id';
    select.innerHTML = '<option value="a">A</option>';
    fixture.appendChild(select);
    const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
    expect(dropdown.trigger.hasAttribute('aria-label')).toBe(false);
    dropdown.destroy();
  });
});

describe('focus + change listener', () => {
  it('focuses the trigger (not a search box) when opened without search', () => {
    const dropdown = new SearchableDropdown({ element: single(), searchable: false, rememberSelection: false });
    mousedown(dropdown.trigger);
    expect(document.activeElement).toBe(dropdown.trigger);
    dropdown.destroy();
  });

  it('fires the change listener with the instance on selection', () => {
    const listener = vi.fn();
    const dropdown = new SearchableDropdown({ element: single(), changeListener: listener, rememberSelection: false });
    dropdown.selectItem(itemByValue(dropdown, 'b'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(dropdown);
    dropdown.destroy();
  });
});

describe('multi-select chips', () => {
  it('renders one chip per selected value and removes on chip × mousedown', () => {
    const select = multi();
    const dropdown = new SearchableDropdown({ element: select, multiselect: true, rememberSelection: false });
    dropdown.selectItem(itemByValue(dropdown, 'a'));
    dropdown.selectItem(itemByValue(dropdown, 'b'));
    expect(dropdown.trigger.querySelectorAll('.sd-chip')).toHaveLength(2);
    mousedown(dropdown.trigger.querySelector('.sd-chip .sd-chip-remove')!);
    expect(dropdown.getSelectedValue()).toEqual(['b']);
    expect(select.querySelector<HTMLOptionElement>("option[value='a']")!.selected).toBe(false);
    dropdown.destroy();
  });

  it('shows the placeholder when nothing is selected', () => {
    const dropdown = new SearchableDropdown({
      selectContainer: buildContainer(),
      multiselect: true,
      placeholder: 'Pick some',
      rememberSelection: false,
    });
    dropdown.addOption('a', 'A');
    const ph = dropdown.trigger.querySelector('.sd-placeholder');
    expect(ph?.textContent).toBe('Pick some');
    dropdown.destroy();
  });

  it('getSelectedText returns an array of labels in multi-select', () => {
    const dropdown = new SearchableDropdown({ element: multi(), multiselect: true, rememberSelection: false });
    dropdown.selectItem(itemByValue(dropdown, 'a'));
    dropdown.selectItem(itemByValue(dropdown, 'c'));
    expect(dropdown.getSelectedText()).toEqual(['A', 'C']);
    dropdown.destroy();
  });

  it('renders the option icon (and its tile) inside a selected chip', () => {
    const dropdown = new SearchableDropdown({
      selectContainer: buildContainer(),
      multiselect: true,
      rememberSelection: false,
    });
    dropdown.addOption('a', 'A', '/i/a.svg', '#1a3a5c');
    dropdown.selectValue('a');
    const icon = dropdown.trigger.querySelector('.sd-chip img.sd-chip-icon') as HTMLElement;
    expect(icon.getAttribute('src')).toBe('/i/a.svg');
    expect(icon.classList.contains('has-icon-bg')).toBe(true);
    dropdown.destroy();
  });

  it('renders no chip icon when the option has no icon', () => {
    const dropdown = new SearchableDropdown({
      selectContainer: buildContainer(),
      multiselect: true,
      rememberSelection: false,
    });
    dropdown.addOption('a', 'A');
    dropdown.selectValue('a');
    const chip = dropdown.trigger.querySelector('.sd-chip')!;
    expect(chip.querySelector('img.sd-chip-icon')).toBeNull();
    expect(chip.querySelector('.sd-chip-label')?.textContent).toBe('A');
    dropdown.destroy();
  });
});

describe('clearable × button', () => {
  it('clears the selection when the × button is pressed', () => {
    const select = document.createElement('select');
    select.innerHTML = '<option value="a">A</option><option value="b" selected>B</option>';
    fixture.appendChild(select);
    const dropdown = new SearchableDropdown({
      element: select,
      clearable: true,
      allowEmpty: true,
      rememberSelection: false,
    });
    expect(dropdown.container.classList.contains('has-value')).toBe(true);
    mousedown(dropdown.clearButton);
    expect(select.selectedIndex).toBe(-1);
    expect(dropdown.container.classList.contains('has-value')).toBe(false);
    dropdown.destroy();
  });
});

describe('refresh + syncFromElement', () => {
  it('refresh keeps build-mode items', () => {
    const dropdown = new SearchableDropdown({ selectContainer: buildContainer(), rememberSelection: false });
    dropdown.addOption('a', 'A');
    dropdown.addOption('b', 'B');
    dropdown.refresh();
    expect(dropdown.items).toHaveLength(2);
    dropdown.destroy();
  });

  it('syncFromElement is a no-op in build mode', () => {
    const dropdown = new SearchableDropdown({ selectContainer: buildContainer(), rememberSelection: false });
    dropdown.addOption('a', 'A');
    expect(() => dropdown.syncFromElement()).not.toThrow();
    expect(dropdown.getSelectedValue()).toBe('a');
    dropdown.destroy();
  });

  it('keeps the first option when the <select> is left blank (no allowEmpty)', () => {
    const select = single();
    const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
    select.selectedIndex = -1;
    select.dispatchEvent(new Event('change'));
    expect(select.selectedIndex).toBe(0);
    expect(dropdown.trigger.value).toBe('A');
    dropdown.destroy();
  });

  it('syncFromElement re-syncs multi-select from the native <select multiple>', () => {
    const select = multi();
    const dropdown = new SearchableDropdown({ element: select, multiselect: true, rememberSelection: false });
    select.querySelector<HTMLOptionElement>("option[value='b']")!.selected = true;
    dropdown.syncFromElement();
    expect(dropdown.getSelectedValue()).toEqual(['b']);
    dropdown.destroy();
  });
});
