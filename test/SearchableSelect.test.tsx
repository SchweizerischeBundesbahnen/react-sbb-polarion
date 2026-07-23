import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import SearchableSelect, { type SelectOption } from '../src/components/SearchableSelect';
import { flush, keydown, mousedown, typeInto } from './helpers';

// Single-select behavior tests driven through the REAL React wrapper (the feature RSP exposes), asserting
// observable DOM - so they survive the eventual move of SearchableDropdown.js's logic into
// SearchableSelect.tsx. Vanilla-only features (multiselect, build mode, icons, ...) are covered against
// the vendored class in SearchableDropdown.test.ts.

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

async function mount(props: Parameters<typeof Controlled>[0] = {}): Promise<void> {
  render(<Controlled {...props} />);
  await vi.waitFor(() => expect(document.querySelector('.searchable-dropdown .sd-trigger')).not.toBeNull());
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
