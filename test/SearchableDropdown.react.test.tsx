import { useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { createEditableSelect } from '../src/generic/searchableSelect.js';
import { mousedown } from './helpers';

// Guards an RSP patch to the vendored SearchableDropdown.js: an editable dropdown must hand what the
// user commits to a React-controlled <input> it wraps. Generic assigned the value and fired `change`,
// which React never sees, so the value was dropped and put back on React's next render. The class-level
// suites wrap a plain <input>, where that difference does not show.

// A consumer as xml-repair and excel-importer write one: the wrapped <input> is controlled by React state.
function Host({ onValue }: Readonly<{ onValue: (value: string) => void }>) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  useEffect(() => {
    const dropdown = createEditableSelect(ref.current!, {
      placeholder: 'HEAD',
      items: [{ value: '1200', label: '1200 - release' }],
    });
    return () => dropdown.destroy();
  }, []);
  return (
    <div className="sbb-ui">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onValue(e.target.value);
        }}
      />
      <button type="button">elsewhere</button>
    </div>
  );
}

const trigger = () => document.querySelector<HTMLInputElement>('.sd-trigger')!;
const wrapped = () => document.querySelector<HTMLInputElement>('input:not(.sd-trigger)')!;

async function mount() {
  const onValue = vi.fn();
  render(<Host onValue={onValue} />);
  await vi.waitFor(() => expect(document.querySelector('.sd-trigger')).not.toBeNull());
  return onValue;
}

afterEach(() => {
  cleanup();
  document.querySelectorAll('.sd-portal').forEach((el) => el.remove());
});

describe('SearchableDropdown - editable, wrapping a React-controlled input (RSP-specific)', () => {
  it('hands a value committed with Enter to the React onChange, which keeps it', async () => {
    const onValue = await mount();
    await userEvent.fill(trigger(), '4321');
    await userEvent.keyboard('{Enter}');
    expect(onValue).toHaveBeenCalledTimes(1);
    expect(onValue).toHaveBeenCalledWith('4321');
    await vi.waitFor(() => expect(wrapped().value).toBe('4321'));
  });

  it('hands a value committed on blur to the React onChange', async () => {
    const onValue = await mount();
    await userEvent.fill(trigger(), '77');
    await userEvent.click(document.querySelector('button')!);
    expect(onValue).toHaveBeenCalledWith('77');
    await vi.waitFor(() => expect(wrapped().value).toBe('77'));
  });

  it('hands a value picked from the list to the React onChange', async () => {
    const onValue = await mount();
    trigger().dispatchEvent(new Event('focus'));
    const option = await vi.waitFor(() => {
      const found = document.querySelector<HTMLElement>('.sd-portal .option');
      expect(found).not.toBeNull();
      return found!;
    });
    mousedown(option);
    expect(onValue).toHaveBeenCalledWith('1200');
    await vi.waitFor(() => expect(wrapped().value).toBe('1200'));
  });
});
