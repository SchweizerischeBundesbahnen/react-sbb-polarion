import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import SearchableSelect, { type SelectOption } from '../src/components/SearchableSelect';
import { flush, keydown, mousedown, typeInto } from './helpers';

// Behavior tests driven through the REAL React wrapper (the feature RSP exposes), asserting observable
// DOM - so they survive the eventual move of SearchableDropdown.js's logic into SearchableSelect.tsx.
// Both modes of the component live here: single-select first, then the `multiple` mode (chips, checkbox
// options) and the per-option icon / indent props. Features reachable only through the class (build mode,
// editable mode, ...) stay covered in SearchableDropdown.test.ts.

const OPTIONS: SelectOption[] = [
  { id: 'a', name: 'First' },
  { id: 'b', name: 'Second' },
  { id: 'c', name: 'Third' },
];

// Controlled host mirroring how consumers use the component (value + onChange feedback loop).
function Controlled(props: {
  initial?: string;
  options?: SelectOption[];
  allowEmpty?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onValue?: (v: string) => void;
}) {
  const { initial = 'a', options = OPTIONS, allowEmpty = false, disabled = false, placeholder = '', onValue } = props;
  const [value, setValue] = useState(initial);
  return (
    <div className="sbb-ui" style={{ width: 240, padding: 16 }}>
      <SearchableSelect
        value={value}
        onChange={(v) => {
          setValue(v);
          onValue?.(v);
        }}
        options={options}
        allowEmpty={allowEmpty}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}

// Grows its option list on a button click - exercises the real "options prop changes" path.
function GrowableHost() {
  const [opts, setOpts] = useState<SelectOption[]>([
    { id: 'a', name: 'First' },
    { id: 'b', name: 'Second' },
  ]);
  const [value, setValue] = useState('a');
  return (
    <div className="sbb-ui">
      <button type="button" data-testid="add-gamma" onClick={() => setOpts((o) => [...o, { id: 'c', name: 'Third' }])}>
        add
      </button>
      <SearchableSelect value={value} onChange={setValue} options={opts} />
    </div>
  );
}

// Multi-select host: the same component, the array-shaped contract.
function MultiControlled(props: {
  initial?: string[];
  options?: SelectOption[];
  placeholder?: string;
  loading?: boolean;
  onValues?: (v: string[]) => void;
}) {
  const { initial = [], options = OPTIONS, placeholder = '', loading = false, onValues } = props;
  const [values, setValues] = useState<string[]>(initial);
  return (
    <div className="sbb-ui" style={{ width: 240, padding: 16 }}>
      <SearchableSelect
        multiple
        value={values}
        onChange={(v) => {
          setValues(v);
          onValues?.(v);
        }}
        options={options}
        placeholder={placeholder}
        loading={loading}
      />
      <button type="button" data-testid="select-bc" onClick={() => setValues(['b', 'c'])}>
        pick b + c
      </button>
    </div>
  );
}

const q = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`not found: ${sel}`);
  return el;
};
const trigger = () => q<HTMLInputElement>('.searchable-dropdown .sd-trigger');
const container = () => q<HTMLElement>('.searchable-dropdown');
const wrappedSelect = () => q<HTMLSelectElement>('select');
const searchBox = () => q<HTMLInputElement>('.sd-portal .search-box');
const options = () => Array.from(document.querySelectorAll<HTMLElement>('.sd-portal .items .option'));
const labels = () => options().map((o) => (o.textContent ?? '').trim());
const optionByText = (text: string): HTMLElement => {
  const found = options().find((o) => (o.textContent ?? '').trim() === text);
  if (!found) throw new Error(`option not found: ${text}`);
  return found;
};

const multiTrigger = () => q<HTMLElement>('.searchable-dropdown .sd-trigger-multi');
const chips = () => Array.from(document.querySelectorAll<HTMLElement>('.sd-chip .sd-chip-label'));
const chipLabels = () => chips().map((c) => (c.textContent ?? '').trim());

async function mount(props: Parameters<typeof Controlled>[0] = {}): Promise<void> {
  render(<Controlled {...props} />);
  await vi.waitFor(() => expect(document.querySelector('.searchable-dropdown .sd-trigger')).not.toBeNull());
}

async function mountMulti(props: Parameters<typeof MultiControlled>[0] = {}): Promise<void> {
  render(<MultiControlled {...props} />);
  await vi.waitFor(() => expect(document.querySelector('.searchable-dropdown .sd-trigger-multi')).not.toBeNull());
}

afterEach(() => {
  cleanup();
  document.querySelectorAll('.sd-portal').forEach((el) => el.remove());
});

describe('SearchableSelect (React wrapper, single-select)', () => {
  it('upgrades the native <select> into the shared SearchableDropdown and shows the selected label', async () => {
    // Behavior only; the appearance of this control is covered in SearchableSelect.visual.test.tsx.
    await mount({ initial: 'a' });
    expect(trigger()).toHaveValue('First');
  });

  it('opens on trigger mousedown and closes on a second mousedown', async () => {
    await mount();
    mousedown(trigger());
    expect(container().classList.contains('open')).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    mousedown(trigger());
    expect(container().classList.contains('open')).toBe(false);
  });

  it('closes when the user clicks outside the control and portal', async () => {
    await mount();
    mousedown(trigger());
    expect(container().classList.contains('open')).toBe(true);
    mousedown(document.body);
    expect(container().classList.contains('open')).toBe(false);
  });

  it('selecting an option fires onChange with its id, updates the trigger, and closes', async () => {
    const onValue = vi.fn();
    await mount({ onValue });
    mousedown(trigger());
    mousedown(optionByText('Second'));
    expect(onValue).toHaveBeenCalledWith('b');
    expect(trigger()).toHaveValue('Second');
    expect(container().classList.contains('open')).toBe(false);
  });

  it('allowEmpty with an empty value shows a blank trigger (no auto-selected first option)', async () => {
    // The wrapper renders a hidden empty <option value="">, so "unselected" is that empty option
    // (value ''), and the trigger must stay blank rather than auto-selecting the first real option.
    await mount({ initial: '', allowEmpty: true, placeholder: 'Select...' });
    expect(wrappedSelect().value).toBe('');
    expect(trigger()).toHaveValue('');
  });

  it('reflects the disabled prop onto the container and does not open', async () => {
    await mount({ disabled: true });
    expect(container().classList.contains('disabled')).toBe(true);
    mousedown(trigger());
    expect(container().classList.contains('open')).toBe(false);
  });

  it('filters the option list as the user types in the search box', async () => {
    await mount();
    mousedown(trigger());
    typeInto(searchBox(), 'seco');
    expect(labels()).toEqual(['Second']);
  });

  it('selects the highlighted option via ArrowDown + Enter and closes', async () => {
    const onValue = vi.fn();
    await mount({ onValue });
    mousedown(trigger());
    keydown(searchBox(), 'ArrowDown');
    const active = q<HTMLElement>('.sd-portal .items .option.active');
    const activeLabel = (active.textContent ?? '').trim();
    const expectedId = OPTIONS.find((o) => o.name === activeLabel)!.id;
    keydown(searchBox(), 'Enter');
    expect(onValue).toHaveBeenCalledWith(expectedId);
    expect(container().classList.contains('open')).toBe(false);
  });

  it('closes on Escape', async () => {
    await mount();
    mousedown(trigger());
    expect(container().classList.contains('open')).toBe(true);
    keydown(searchBox(), 'Escape');
    expect(container().classList.contains('open')).toBe(false);
  });

  it('opens from the closed trigger on ArrowDown', async () => {
    await mount();
    expect(container().classList.contains('open')).toBe(false);
    keydown(trigger(), 'ArrowDown');
    expect(container().classList.contains('open')).toBe(true);
  });

  it('without allowEmpty, an empty value displays the first option (native-select mimic)', async () => {
    // A native <select> never stays blank, and the control mimics that: with an empty value and no
    // allowEmpty, the trigger falls back to showing the first option. Note it does NOT fire onChange back
    // to React (state stays ''), which is exactly why consumers pass allowEmpty to keep the trigger blank
    // (contrast the allowEmpty test above). Documented behavior, not a bug.
    await mount({ initial: '', allowEmpty: false });
    expect(trigger()).toHaveValue('First');
  });

  it('exposes ARIA combobox/listbox semantics', async () => {
    await mount();
    const t = trigger();
    expect(t.getAttribute('role')).toBe('combobox');
    expect(t.getAttribute('aria-haspopup')).toBe('listbox');
    expect(t.getAttribute('aria-expanded')).toBe('false');
    mousedown(t);
    expect(t.getAttribute('aria-expanded')).toBe('true');
    expect(q('.sd-portal .items').getAttribute('role')).toBe('listbox');
    expect(options()[0].getAttribute('role')).toBe('option');
  });

  it('re-extracts items when the options prop changes (MutationObserver)', async () => {
    render(<GrowableHost />);
    await vi.waitFor(() => expect(document.querySelector('.searchable-dropdown .sd-trigger')).not.toBeNull());
    mousedown(trigger());
    expect(labels()).toEqual(['First', 'Second']);
    mousedown(trigger()); // close

    q<HTMLButtonElement>('[data-testid="add-gamma"]').click();
    await flush();

    mousedown(trigger());
    expect(labels()).toEqual(['First', 'Second', 'Third']);
  });
});

describe('SearchableSelect (React wrapper, multi-select)', () => {
  it('renders the placeholder while nothing is selected', async () => {
    await mountMulti({ placeholder: 'All items' });
    expect(chipLabels()).toEqual([]);
    expect(q('.sd-trigger-multi .sd-placeholder').textContent).toBe('All items');
  });

  it('renders one chip per selected value, in option order', async () => {
    await mountMulti({ initial: ['c', 'a'] });
    // The chips follow the option list, not the order the values were passed in.
    expect(chipLabels()).toEqual(['First', 'Third']);
  });

  it('checking an option adds it to the value list and keeps the popup open', async () => {
    const onValues = vi.fn();
    await mountMulti({ initial: ['a'], onValues });
    mousedown(multiTrigger());
    mousedown(optionByText('Second'));
    expect(onValues).toHaveBeenCalledWith(['a', 'b']);
    // Picking one of several is the normal case, so the list stays open (unlike single-select).
    expect(container().classList.contains('open')).toBe(true);
    await vi.waitFor(() => expect(chipLabels()).toEqual(['First', 'Second']));
  });

  it('checking a selected option again removes it from the value list', async () => {
    const onValues = vi.fn();
    await mountMulti({ initial: ['a', 'b'], onValues });
    mousedown(multiTrigger());
    mousedown(optionByText('First'));
    expect(onValues).toHaveBeenCalledWith(['b']);
  });

  it('renders the popup options as checkboxes reflecting the selection', async () => {
    await mountMulti({ initial: ['b'] });
    mousedown(multiTrigger());
    const boxes = options().map((o) => o.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
    expect(boxes.map((b) => b.checked)).toEqual([false, true, false]);
  });

  it('removing a chip drops that value and leaves the others', async () => {
    const onValues = vi.fn();
    await mountMulti({ initial: ['a', 'b'], onValues });
    mousedown(q<HTMLElement>('.sd-chip .sd-chip-remove'));
    expect(onValues).toHaveBeenCalledWith(['b']);
    await vi.waitFor(() => expect(chipLabels()).toEqual(['Second']));
  });

  it('repaints the chips when the selection is driven from React state', async () => {
    await mountMulti({ initial: ['a'] });
    expect(chipLabels()).toEqual(['First']);
    q<HTMLButtonElement>('[data-testid="select-bc"]').click();
    await vi.waitFor(() => expect(chipLabels()).toEqual(['Second', 'Third']));
  });

  it('shows a chip for a selected value whose option arrives after mount', async () => {
    // The async-load case: the selection is restored (from a cookie, say) before the option list is
    // fetched. React marks the late option as selected and the dropdown's own observer re-reads it, so
    // the wrapper needs no extra work - this test is what guarantees that.
    function LateOptionsHost() {
      const [options, setOptions] = useState<SelectOption[]>([{ id: 'a', name: 'First' }]);
      const [values, setValues] = useState<string[]>(['b']);
      return (
        <div className="sbb-ui">
          <button type="button" data-testid="load" onClick={() => setOptions(OPTIONS)}>
            load
          </button>
          <SearchableSelect multiple value={values} onChange={setValues} options={options} />
        </div>
      );
    }
    render(<LateOptionsHost />);
    await vi.waitFor(() => expect(document.querySelector('.sd-trigger-multi')).not.toBeNull());
    expect(chipLabels()).toEqual([]);

    q<HTMLButtonElement>('[data-testid="load"]').click();
    await vi.waitFor(() => expect(chipLabels()).toEqual(['Second']));
  });

  it('renders disabled while the option list is loading', async () => {
    await mountMulti({ loading: true });
    expect(wrappedSelect().disabled).toBe(true);
    expect(container().classList.contains('disabled')).toBe(true);
  });

  it('rebuilds the control when the mode is flipped', async () => {
    // The dropdown takes `multiselect` at construction time, so the wrapper keys the instance on the
    // prop: without the rebuild the control would keep showing a single-select trigger.
    function ModeHost() {
      const [multiple, setMultiple] = useState(false);
      const [value, setValue] = useState('a');
      const [values, setValues] = useState<string[]>(['a', 'b']);
      return (
        <div className="sbb-ui">
          <button type="button" data-testid="flip" onClick={() => setMultiple(true)}>
            flip
          </button>
          {multiple ? (
            <SearchableSelect multiple value={values} onChange={setValues} options={OPTIONS} />
          ) : (
            <SearchableSelect value={value} onChange={setValue} options={OPTIONS} />
          )}
        </div>
      );
    }
    render(<ModeHost />);
    await vi.waitFor(() => expect(document.querySelector('.sd-trigger')).not.toBeNull());
    expect(trigger()).toHaveValue('First');
    expect(document.querySelector('.sd-trigger-multi')).toBeNull();

    q<HTMLButtonElement>('[data-testid="flip"]').click();
    await vi.waitFor(() => expect(document.querySelector('.sd-trigger-multi')).not.toBeNull());
    expect(chipLabels()).toEqual(['First', 'Second']);
    // Exactly one control: the previous instance was destroyed, not left behind.
    expect(document.querySelectorAll('.searchable-dropdown').length).toBe(1);
  });
});

describe('SearchableSelect option decorations', () => {
  const ICON = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27/%3E';
  const DECORATED: SelectOption[] = [
    { id: 'a', name: 'Parent', iconURL: ICON, iconBg: '#1a3a5c' },
    { id: 'b', name: 'Child', iconURL: ICON, indent: true },
    { id: 'c', name: 'Plain' },
  ];

  it('carries the icon, its background and the indent class onto the popup options', async () => {
    await mount({ options: DECORATED });
    mousedown(trigger());
    const [parent, child, plain] = options();
    expect(parent.querySelector<HTMLImageElement>('img.option-icon')?.src).toContain('svg');
    expect(parent.querySelector<HTMLImageElement>('img.option-icon')?.style.backgroundColor).toBe('rgb(26, 58, 92)');
    expect(child.classList.contains('indented')).toBe(true);
    expect(parent.classList.contains('indented')).toBe(false);
    // An option without decorations renders no icon at all.
    expect(plain.querySelector('img.option-icon')).toBeNull();
  });

  it('shows the icon of the selected option on the multi-select chip', async () => {
    await mountMulti({ initial: ['a'], options: DECORATED });
    expect(q<HTMLImageElement>('.sd-chip img.sd-chip-icon').src).toContain('svg');
  });
});
