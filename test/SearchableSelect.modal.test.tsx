import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import Modal from '../src/components/Modal';
import SearchableSelect, { type SelectOption } from '../src/components/SearchableSelect';
import { flush, mousedown } from './helpers';

// A <dialog> opened with showModal() paints in the browser's top layer, which is above the normal layer
// whatever the z-index says. The option list is a portal outside the dialog, so no z-index can put it in
// front - it has to enter the top layer too. These tests assert that from the outside: what the user's
// click would actually hit at the popup's own coordinates.

const OPTIONS: SelectOption[] = [
  { id: 'a', name: 'First' },
  { id: 'b', name: 'Second' },
  { id: 'c', name: 'Third' },
];

function ModalWithSelect() {
  const [value, setValue] = useState('a');
  return (
    <Modal open title="Export" onOk={() => {}} onCancel={() => {}}>
      <div style={{ width: 240 }}>
        <SearchableSelect value={value} onChange={setValue} options={OPTIONS} />
      </div>
    </Modal>
  );
}

const portal = () => document.querySelector<HTMLElement>('.sd-portal')!;
const trigger = () => document.querySelector<HTMLInputElement>('.searchable-dropdown .sd-trigger')!;
const optionsList = () => portal().querySelector<HTMLElement>('.options')!;

// The element the browser paints at a point inside the open popup. The portal itself is a zero-height
// positioned wrapper - the painted box is the .options list inside it, so probe that.
const topmostAtPopup = (): Element | null => {
  const rect = optionsList().getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + Math.min(12, rect.height / 2);
  return document.elementFromPoint(x, y);
};

afterEach(cleanup);

describe('SearchableSelect inside a Modal', () => {
  it('paints the option list above the dialog', async () => {
    render(<ModalWithSelect />);
    await flush();

    mousedown(trigger());
    await flush();

    expect(optionsList().getBoundingClientRect().height).toBeGreaterThan(0);

    const hit = topmostAtPopup();
    expect(hit, 'nothing painted at the popup coordinates').not.toBeNull();
    expect(portal().contains(hit), `dialog paints over the option list, hit: ${hit?.className}`).toBe(true);
  });

  it('is clickable through to a selection', async () => {
    render(<ModalWithSelect />);
    await flush();

    mousedown(trigger());
    await flush();

    const second = [...portal().querySelectorAll<HTMLElement>('.items .option')].find((o) =>
      o.textContent?.includes('Second'),
    )!;
    mousedown(second);
    await flush();

    expect(trigger().value).toBe('Second');
  });
});
