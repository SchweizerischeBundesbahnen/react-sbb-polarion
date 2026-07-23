import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SearchableDropdown from '../src/generic/SearchableDropdown.js';
import { mousedown } from './helpers';

// Vanilla-class public-API behaviors ported behavior-level from generic's suite: selectItem, the
// build-mode addOption/selectValue/selectMultipleValues re-render, the id getter and value setter/getter,
// element mode wrapping a non-<select> element, and misc build-mode branches. Private `_open()` calls are
// replaced by a real open (mousedown the trigger). The `_visibleItems`/viewport-size defensive-fallback
// micro-tests are intentionally not ported (private branches with no observable behavior).

let fixture: HTMLDivElement;

beforeEach(() => {
  fixture = document.createElement('div');
  fixture.innerHTML = `
    <div id="build-container"></div>
    <select id="single">
      <option value="a">A</option>
      <option value="b">B</option>
      <option value="c" disabled>C</option>
    </select>`;
  document.body.appendChild(fixture);
});

afterEach(() => {
  fixture.remove();
  document.querySelectorAll('.sd-portal').forEach((el) => el.remove());
});

const buildContainer = () => document.getElementById('build-container')!;
const single = () => document.getElementById('single') as HTMLSelectElement;
const build = () => new SearchableDropdown({ selectContainer: buildContainer(), rememberSelection: false });
const itemByValue = (d: SearchableDropdown, value: string) => d.items.find((i: { value: string }) => i.value === value);
const optionLabels = (d: SearchableDropdown) =>
  Array.from(d.itemsEl.children as HTMLCollection).map((o) => (o.textContent ?? '').trim());

describe('selectItem', () => {
  it('sets the native <select> value on selection (element single)', () => {
    const select = single();
    const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
    dropdown.selectItem(itemByValue(dropdown, 'b'));
    expect(select.value).toBe('b');
    expect(dropdown.trigger.value).toBe('B');
    dropdown.destroy();
  });

  it('updates item selected flags in build mode', () => {
    const dropdown = build();
    dropdown.addOption('a', 'A');
    dropdown.addOption('b', 'B');
    dropdown.selectItem(itemByValue(dropdown, 'b'));
    expect(dropdown.getSelectedValue()).toBe('b');
    expect(itemByValue(dropdown, 'a').selected).toBe(false);
    dropdown.destroy();
  });
});

describe('build-mode API: addOption handle + open re-render', () => {
  it('re-renders the open list when a new option is added', () => {
    const dropdown = build();
    dropdown.addOption('a', 'A');
    mousedown(dropdown.trigger);
    dropdown.addOption('b', 'B');
    expect(optionLabels(dropdown)).toContain('B');
    dropdown.destroy();
  });

  it('option handle classList add/remove/toggle mirrors onto the item + rendered option', () => {
    const dropdown = build();
    const handle = dropdown.addOption('a', 'A');
    handle.label.classList.add('parent');
    expect(dropdown.items[0].className).toContain('parent');

    mousedown(dropdown.trigger); // open so mutate() hits the re-render branch
    handle.label.classList.toggle('marker'); // adds
    expect(dropdown.items[0].className).toContain('marker');
    expect(dropdown.itemsEl.querySelector('.option')!.classList.contains('marker')).toBe(true);
    handle.label.classList.toggle('marker'); // removes
    expect(dropdown.items[0].className).not.toContain('marker');
    dropdown.destroy();
  });

  it('empty() re-renders the (now empty) open list', () => {
    const dropdown = build();
    dropdown.addOption('a', 'A');
    mousedown(dropdown.trigger);
    dropdown.empty();
    expect(dropdown.itemsEl.querySelectorAll('.option').length).toBe(0);
    expect(dropdown.itemsEl.querySelector('.sd-empty')).not.toBeNull();
    dropdown.destroy();
  });
});

describe('selectValue + selectMultipleValues open re-render', () => {
  it('selectValue re-renders the open list in build mode', () => {
    const dropdown = build();
    dropdown.addOption('a', 'A');
    dropdown.addOption('b', 'B');
    mousedown(dropdown.trigger);
    dropdown.selectValue('b');
    const selected = Array.from(dropdown.itemsEl.children as HTMLCollection).find(
      (o) => o.getAttribute('aria-selected') === 'true',
    );
    expect(selected?.textContent?.trim()).toBe('B');
    dropdown.destroy();
  });

  it('selectValue sets a native <select> value (element mode) and falls back on no match', () => {
    const select = single();
    const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
    dropdown.selectValue('b');
    expect(select.value).toBe('b');
    dropdown.selectValue('nope'); // no match -> keeps first option
    expect(select.selectedIndex).toBe(0);
    dropdown.destroy();
  });

  it('selectMultipleValues re-renders the open list', () => {
    const dropdown = new SearchableDropdown({
      selectContainer: buildContainer(),
      multiselect: true,
      rememberSelection: false,
    });
    dropdown.addOption('a', 'A');
    dropdown.addOption('b', 'B');
    mousedown(dropdown.trigger);
    dropdown.selectMultipleValues(['a', 'b']);
    expect(dropdown.itemsEl.querySelectorAll('input[type="checkbox"]:checked').length).toBe(2);
    dropdown.destroy();
  });
});

describe('id getter + value setter/getter', () => {
  it('id returns the container id in build mode and the element id in element mode', () => {
    const container = document.createElement('div');
    container.id = 'cid';
    fixture.appendChild(container);
    const buildDd = new SearchableDropdown({ selectContainer: container, rememberSelection: false });
    expect(buildDd.id).toBe('cid');
    buildDd.destroy();

    const el = new SearchableDropdown({ element: single(), rememberSelection: false });
    expect(el.id).toBe('single');
    el.destroy();
  });

  it('value setter selects a matching option on a native <select> and ignores a no-match', () => {
    const select = single();
    const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
    dropdown.value = 'b';
    expect(select.value).toBe('b');
    expect(dropdown.trigger.value).toBe('B');
    dropdown.value = 'zzz';
    expect(select.value).toBe('b');
    dropdown.destroy();
  });

  it('value setter delegates to selectValue in build mode', () => {
    const dropdown = build();
    dropdown.addOption('a', 'A');
    dropdown.addOption('b', 'B');
    dropdown.value = 'b';
    expect(dropdown.getSelectedValue()).toBe('b');
    dropdown.destroy();
  });

  it('value setter writes the trigger directly for a non-<select> element', () => {
    const input = document.createElement('input');
    fixture.appendChild(input);
    const dropdown = new SearchableDropdown({
      element: input,
      items: [{ value: 'x', label: 'X' }],
      rememberSelection: false,
    });
    expect(dropdown.isSelect).toBe(false);
    dropdown.value = 'hello';
    expect(dropdown.trigger.value).toBe('hello');
    expect(dropdown.value).toBe('hello');
    dropdown.destroy();
  });

  it('getSelectedText derives the label from the live value in element single mode', () => {
    const dropdown = new SearchableDropdown({ element: single(), rememberSelection: false });
    expect(dropdown.getSelectedText()).toBe('A');
    dropdown.destroy();
  });
});

describe('element mode wrapping a non-<select> element', () => {
  const nonSelect = () => {
    const input = document.createElement('input');
    fixture.appendChild(input);
    return new SearchableDropdown({
      element: input,
      items: [
        { value: 'x', label: 'X' },
        { value: 'y', label: 'Y' },
      ],
      rememberSelection: false,
    });
  };

  it('getSelectedValue reads the trigger value (no native <select>)', () => {
    const dropdown = nonSelect();
    dropdown.trigger.value = 'anything';
    expect(dropdown.getSelectedValue()).toBe('anything');
    dropdown.destroy();
  });

  it('syncFromElement maps the trigger value to the matching item label', () => {
    const dropdown = nonSelect();
    dropdown.trigger.value = 'x';
    dropdown.syncFromElement();
    expect(dropdown.trigger.value).toBe('X');
    dropdown.destroy();
  });

  it('getSelectedText returns empty when the value matches no item', () => {
    const dropdown = nonSelect();
    dropdown.trigger.value = 'no-match';
    expect(dropdown.getSelectedText()).toBe('');
    dropdown.destroy();
  });

  it('refresh keeps the existing items for a non-<select> element', () => {
    const dropdown = nonSelect();
    dropdown.refresh();
    expect(dropdown.items.map((i: { value: string }) => i.value)).toEqual(['x', 'y']);
    dropdown.destroy();
  });
});

describe('misc build-mode branches', () => {
  it('addOption uses the value as the label when no text is given', () => {
    const dropdown = build();
    dropdown.addOption('only-value');
    expect(dropdown.getSelectedText()).toBe('only-value');
    dropdown.destroy();
  });

  it('getSelectedText is empty in build mode when nothing is selected', () => {
    const dropdown = new SearchableDropdown({
      selectContainer: buildContainer(),
      allowEmpty: true,
      rememberSelection: false,
    });
    dropdown.addOption('a', 'A'); // allowEmpty => not auto-selected
    expect(dropdown.getSelectedText()).toBe('');
    dropdown.destroy();
  });
});
