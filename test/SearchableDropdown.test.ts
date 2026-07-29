import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SearchableDropdown from '../src/generic/SearchableDropdown.js';
import { flush, mousedown } from './helpers';

const clearCookies = () => {
  for (const c of document.cookie.split(';')) {
    document.cookie = `${c.split('=')[0].trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
};

// Behavior tests at the vendored-class level: build mode (CustomSelect-compatible addOption API), the
// clearable (×) button - neither reachable through the React wrapper - and the class-level contract of
// multi-select, which the wrapper does expose but drives through a <select multiple>. Everything the
// wrapper exposes is covered through it in SearchableSelect.test.tsx.
//
// Ported behavior-level from generic's Mocha/Chai/jsdom suite
// (ch.sbb.polarion.extension.generic, app/src/test/js/modules/SearchableDropdownTest.js) into Vitest
// browser mode: chai -> vitest matchers; JSDOM bootstrap + sinon deleted (real Chromium); one shared
// document, so the fixture and any body-level portal are torn down per test. Uses only the class's
// public API + observable DOM - no private internals - so the intent survives the eventual React rewrite.

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
  clearCookies();
});

describe('SearchableDropdown - class-level features (ported from generic)', () => {
  describe('build mode (CustomSelect-compatible API)', () => {
    const build = () =>
      new SearchableDropdown({
        selectContainer: document.getElementById('build-container')!,
        rememberSelection: false,
      });

    it('defaults the selection to the first added option', () => {
      const dropdown = build();
      dropdown.addOption('a', 'Apple');
      dropdown.addOption('b', 'Banana');
      expect(dropdown.getSelectedValue()).toBe('a');
      expect(dropdown.getSelectedText()).toBe('Apple');
      dropdown.destroy();
    });

    it('selectValue selects a matching option', () => {
      const dropdown = build();
      dropdown.addOption('a', 'Apple');
      dropdown.addOption('b', 'Banana');
      dropdown.selectValue('b');
      expect(dropdown.getSelectedValue()).toBe('b');
      expect(dropdown.getSelectedText()).toBe('Banana');
      dropdown.destroy();
    });

    it('falls back to the first option when the value matches nothing', () => {
      const dropdown = build();
      dropdown.addOption('a', 'Apple');
      dropdown.addOption('b', 'Banana');
      dropdown.selectValue('does-not-exist');
      expect(dropdown.getSelectedValue()).toBe('a');
      dropdown.destroy();
    });

    it('containsOption and empty() behave as expected', () => {
      const dropdown = build();
      dropdown.addOption('a', 'Apple');
      expect(dropdown.containsOption('a')).toBe(true);
      expect(dropdown.containsOption('x')).toBe(false);
      dropdown.empty();
      expect(dropdown.containsOption('a')).toBe(false);
      expect(dropdown.getSelectedValue()).toBe('');
      dropdown.destroy();
    });
  });

  describe('multi-select (native <select multiple>)', () => {
    const multi = () =>
      new SearchableDropdown({
        element: document.getElementById('multi')!,
        multiselect: true,
        rememberSelection: false,
      });
    const itemByValue = (dropdown: SearchableDropdown, value: string) =>
      dropdown.items.find((i: { value: string }) => i.value === value);

    it('starts with nothing selected', () => {
      const dropdown = multi();
      expect(dropdown.getSelectedValue()).toEqual([]);
      dropdown.destroy();
    });

    it('toggling an option mirrors onto the native <select multiple>', () => {
      const dropdown = multi();
      const select = document.getElementById('multi') as HTMLSelectElement;
      dropdown.selectItem(itemByValue(dropdown, 'b'));
      expect(dropdown.getSelectedValue()).toEqual(['b']);
      expect(select.querySelector<HTMLOptionElement>("option[value='b']")!.selected).toBe(true);
      dropdown.destroy();
    });

    it('keeps multiple selected values', () => {
      const dropdown = multi();
      dropdown.selectItem(itemByValue(dropdown, 'a'));
      dropdown.selectItem(itemByValue(dropdown, 'c'));
      expect(dropdown.getSelectedValue()).toEqual(['a', 'c']);
      dropdown.destroy();
    });

    it('toggling the same option twice deselects it', () => {
      const dropdown = multi();
      const select = document.getElementById('multi') as HTMLSelectElement;
      const item = itemByValue(dropdown, 'a');
      dropdown.selectItem(item);
      dropdown.selectItem(item);
      expect(dropdown.getSelectedValue()).toEqual([]);
      expect(select.querySelector<HTMLOptionElement>("option[value='a']")!.selected).toBe(false);
      dropdown.destroy();
    });

    it('empty() clears rendered chips in build mode', () => {
      const dropdown = new SearchableDropdown({
        selectContainer: document.getElementById('build-container')!,
        multiselect: true,
        rememberSelection: false,
      });
      dropdown.addOption('a', 'A');
      dropdown.addOption('b', 'B');
      dropdown.selectMultipleValues(['a', 'b']);
      expect(dropdown.trigger.querySelectorAll('.sd-chip').length).toBe(2);
      dropdown.empty();
      expect(dropdown.trigger.querySelectorAll('.sd-chip').length).toBe(0);
      expect(dropdown.getSelectedValue()).toEqual([]);
      dropdown.destroy();
    });
  });

  describe('clearable (× reset button)', () => {
    // Clearable pairs with allowEmpty; start on a real value (option B pre-selected).
    const clearable = () => {
      const select = document.createElement('select');
      select.innerHTML = '<option value="a">A</option><option value="b" selected>B</option>';
      fixture.appendChild(select);
      return {
        select,
        dropdown: new SearchableDropdown({
          element: select,
          clearable: true,
          allowEmpty: true,
          rememberSelection: false,
        }),
      };
    };

    it('shows the clear button on initial render when a value is pre-selected', () => {
      const { dropdown } = clearable();
      expect(dropdown.container.classList.contains('clearable')).toBe(true);
      expect(dropdown.container.querySelector('.sd-clear')).not.toBeNull();
      expect(dropdown.container.classList.contains('has-value')).toBe(true);
      dropdown.destroy();
    });

    it('clearing resets the selection to the placeholder and hides the clear button', () => {
      const { select, dropdown } = clearable();
      dropdown.selectItem(null);
      expect(select.selectedIndex).toBe(-1);
      expect(dropdown.container.classList.contains('has-value')).toBe(false);
      dropdown.destroy();
    });
  });

  describe('constructor validation', () => {
    it('throws when neither element nor selectContainer is given', () => {
      expect(() => new SearchableDropdown({})).toThrow('element or selectContainer is required');
    });

    it('throws when the selectContainer selector matches nothing', () => {
      expect(() => new SearchableDropdown({ selectContainer: '#no-such-container' })).toThrow(
        'selectContainer not found',
      );
    });

    it('throws when the element selector matches nothing', () => {
      expect(() => new SearchableDropdown({ element: '#no-such-element' })).toThrow('element not found');
    });

    it('resolves element and selectContainer passed as string selectors', () => {
      const byString = new SearchableDropdown({ element: '#single', rememberSelection: false });
      expect(byString.originalElement).toBe(document.getElementById('single'));
      byString.destroy();
      const buildByString = new SearchableDropdown({ selectContainer: '#build-container', rememberSelection: false });
      expect(buildByString.container).toBe(document.getElementById('build-container'));
      buildByString.destroy();
    });
  });

  describe('element-mode wiring & lifecycle', () => {
    it('re-wrapping the same <select> does not stack duplicate containers/portals', () => {
      const select = document.getElementById('multi') as HTMLSelectElement;
      new SearchableDropdown({ element: select, rememberSelection: false });
      new SearchableDropdown({ element: select, rememberSelection: false });
      const last = new SearchableDropdown({ element: select, rememberSelection: false });
      expect(document.querySelectorAll('.searchable-dropdown').length).toBe(1);
      expect(document.querySelectorAll('.sd-portal').length).toBe(1);
      last.destroy();
    });

    it('destroy() restores selectedIndex so allowEmpty does not leak to a re-wrap', () => {
      const select = document.getElementById('single') as HTMLSelectElement;
      // First instance clears the selection (allowEmpty); re-wrapping without allowEmpty must see the
      // first option again, not the -1 left behind.
      new SearchableDropdown({ element: select, allowEmpty: true, placeholder: 'Select...', rememberSelection: false });
      expect(select.selectedIndex).toBe(-1);
      const second = new SearchableDropdown({ element: select, rememberSelection: false });
      expect(second.getSelectedValue()).toBe('a');
      second.destroy();
    });

    it('mirrors the <select> title tooltip onto the trigger', () => {
      const select = document.getElementById('single') as HTMLSelectElement;
      select.setAttribute('title', 'Choose a size');
      const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
      expect(dropdown.trigger.getAttribute('title')).toBe('Choose a size');
      dropdown.destroy();
    });

    it('mirrors an explicit <select> width onto the container', () => {
      const select = document.getElementById('single') as HTMLSelectElement;
      select.style.width = '142px';
      const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
      expect(dropdown.container.style.width).toBe('142px');
      dropdown.destroy();
    });
  });

  describe('body portal', () => {
    it('destroy() removes the body-level portal', () => {
      const dropdown = new SearchableDropdown({
        selectContainer: document.getElementById('build-container')!,
        rememberSelection: false,
      });
      expect(document.querySelectorAll('.sd-portal').length).toBe(1);
      dropdown.destroy();
      expect(document.querySelectorAll('.sd-portal').length).toBe(0);
    });

    it('scopes the body-level portal with .sbb-ui so its tokens match the trigger', () => {
      const dropdown = new SearchableDropdown({
        selectContainer: document.getElementById('build-container')!,
        rememberSelection: false,
      });
      expect(document.querySelector('.sd-portal')!.classList.contains('sbb-ui')).toBe(true);
      dropdown.destroy();
    });
  });

  describe('build mode label + trigger id wiring', () => {
    it('assigns a trigger id derived from the container id and wires <label for>', () => {
      const container = document.createElement('div');
      container.id = 'my-build';
      fixture.appendChild(container);
      const label = document.createElement('label');
      const dropdown = new SearchableDropdown({ selectContainer: container, label, rememberSelection: false });
      expect(dropdown.trigger.id).toBe('my-build_sd-trigger');
      expect(label.htmlFor).toBe('my-build_sd-trigger');
      dropdown.destroy();
    });
  });

  describe('rememberSelection (cookie)', () => {
    it('remembers the selection across a re-wrap of the same <select>', () => {
      const select = document.getElementById('single') as HTMLSelectElement;
      const first = new SearchableDropdown({ element: select }); // rememberSelection defaults true (has id)
      expect(first.rememberSelection).toBe(true);
      first.selectItem(first.items.find((i: { value: string }) => i.value === 'b'));
      first.destroy();

      const second = new SearchableDropdown({ element: select });
      second.restoreSelection();
      expect(second.getSelectedValue()).toBe('b');
      second.destroy();
    });

    it('restoreSelection clears the selection when no cookie is saved', () => {
      clearCookies();
      const select = document.getElementById('single') as HTMLSelectElement;
      const dropdown = new SearchableDropdown({ element: select, allowEmpty: true });
      dropdown.restoreSelection();
      expect(select.selectedIndex).toBe(-1);
      dropdown.destroy();
    });
  });

  describe('MutationObserver-driven sync', () => {
    it('mirrors the <select> display onto the container when style changes', async () => {
      const select = document.getElementById('single') as HTMLSelectElement;
      const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
      select.style.display = 'none';
      await flush();
      expect(dropdown.container.style.display).toBe('none');
      dropdown.destroy();
    });

    it('mirrors the disabled attribute onto the container', async () => {
      const select = document.getElementById('single') as HTMLSelectElement;
      const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
      select.disabled = true;
      await flush();
      expect(dropdown.container.classList.contains('disabled')).toBe(true);
      dropdown.destroy();
    });

    it('re-extracts items when the <select> options change', async () => {
      const select = document.getElementById('single') as HTMLSelectElement;
      const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
      const opt = document.createElement('option');
      opt.value = 'd';
      opt.text = 'D';
      select.appendChild(opt);
      await flush();
      expect(dropdown.items.some((i: { value: string }) => i.value === 'd')).toBe(true);
      dropdown.destroy();
    });

    it('re-renders the open option list when the <select> options change while open', async () => {
      const select = document.getElementById('single') as HTMLSelectElement;
      const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
      mousedown(dropdown.trigger);
      const opt = document.createElement('option');
      opt.value = 'd';
      opt.text = 'D';
      select.appendChild(opt);
      await flush();
      const labels = Array.from(dropdown.itemsEl.children as HTMLCollection).map((o) => (o.textContent ?? '').trim());
      expect(labels).toContain('D');
      dropdown.destroy();
    });

    it('closes an open popup when the control becomes disabled', async () => {
      const select = document.getElementById('single') as HTMLSelectElement;
      const dropdown = new SearchableDropdown({ element: select, rememberSelection: false });
      mousedown(dropdown.trigger);
      expect(dropdown.isOpen).toBe(true);
      select.disabled = true;
      await flush();
      expect(dropdown.isOpen).toBe(false);
      dropdown.destroy();
    });
  });
});
