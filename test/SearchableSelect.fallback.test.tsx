import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import SearchableSelect, { type SelectOption } from '../src/components/SearchableSelect';

// The wrapper upgrades a native <select> to the vendored SearchableDropdown, but it is written to
// survive that upgrade failing (an exotic host document, a future generic that throws on an
// unsupported control): the plain <select> stays behind and keeps working. That path cannot be reached
// with the real module, so the factory is stubbed to throw - which is why this lives in its own file,
// vi.mock being hoisted per module graph.

vi.mock('../src/generic/searchableSelect.js', () => ({
  createSearchableSelect: () => {
    throw new Error('SearchableDropdown unavailable');
  },
}));

const OPTIONS: SelectOption[] = [
  { id: 'a', name: 'First' },
  { id: 'b', name: 'Second' },
];

function Controlled({ onValue }: { onValue?: (value: string) => void }) {
  const [value, setValue] = useState('a');
  return (
    <div className="sbb-ui" style={{ width: 240, padding: 16 }}>
      <SearchableSelect
        id="fallback-select"
        value={value}
        options={OPTIONS}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
      />
    </div>
  );
}

const select = () => document.querySelector<HTMLSelectElement>('#fallback-select');

afterEach(cleanup);

describe('SearchableSelect when the dropdown cannot be created', () => {
  it('leaves the native select in place, still listing every option', async () => {
    render(<Controlled />);
    await vi.waitFor(() => expect(select()).not.toBeNull());

    // No dropdown was built, so no trigger replaced the control.
    expect(document.querySelector('.searchable-dropdown')).toBeNull();
    expect(Array.from(select()!.options).map((o) => o.value)).toEqual(['a', 'b']);
    expect(select()!.value).toBe('a');
  });

  it('still reports a selection made through the native select', async () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);
    await vi.waitFor(() => expect(select()).not.toBeNull());

    select()!.value = 'b';
    select()!.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => expect(onValue).toHaveBeenCalledWith('b'));
    expect(select()!.value).toBe('b');
  });

  it('unmounts cleanly when there is no dropdown instance to destroy', async () => {
    render(<Controlled />);
    await vi.waitFor(() => expect(select()).not.toBeNull());

    expect(() => cleanup()).not.toThrow();
    expect(select()).toBeNull();
  });
});
