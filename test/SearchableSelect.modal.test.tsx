import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
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

function ModalWithSelect({ onCancel = () => {} }: { onCancel?: () => void }) {
  const [value, setValue] = useState('a');
  return (
    <Modal open title="Export" onOk={() => {}} onCancel={onCancel}>
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

  it('lets Escape close the list without closing the dialog', async () => {
    const onCancel = vi.fn();
    render(<ModalWithSelect onCancel={onCancel} />);
    await flush();

    mousedown(trigger());
    await flush();
    expect(optionsList().getBoundingClientRect().height).toBeGreaterThan(0);

    // A real key press, not a synthetic keydown: Escape on a modal <dialog> is a close request the
    // browser handles itself, and a hand-dispatched KeyboardEvent never produces it.
    await userEvent.keyboard('{Escape}');
    await flush();

    expect(optionsList().getBoundingClientRect().height, 'the option list stayed open').toBe(0);
    expect(onCancel, 'Escape closed the dialog as well as the list').not.toHaveBeenCalled();
    // Dismissing the popup returns to the combobox. Without it focus is stranded on the hidden search
    // box and falls back to the body, which is inert while the dialog is open - the keyboard user
    // loses their place in the form.
    expect(document.activeElement, 'focus did not return to the combobox').toBe(trigger());
  });

  it('lets a second Escape close the dialog', async () => {
    const onCancel = vi.fn();
    render(<ModalWithSelect onCancel={onCancel} />);
    await flush();

    mousedown(trigger());
    await flush();
    await userEvent.keyboard('{Escape}');
    await flush();
    expect(onCancel).not.toHaveBeenCalled();

    // The popup is closed now, so the control passes the key on - this is what the isOpen guard on the
    // preventDefault above exists to preserve.
    await userEvent.keyboard('{Escape}');
    await flush();
    expect(onCancel, 'Escape no longer reaches the dialog').toHaveBeenCalledTimes(1);
  });

  it('is clickable through to a selection', async () => {
    render(<ModalWithSelect />);
    await flush();

    mousedown(trigger());
    await flush();

    const second = [...portal().querySelectorAll<HTMLElement>('.items .option')].find((o) =>
      o.textContent?.includes('Second'),
    )!;
    // A real click, not the synthetic mousedown helper: dispatchEvent reaches an inert target and does
    // no hit-testing, so it would select just as happily with the popup buried behind the dialog. This
    // goes through Playwright's actionability check, which is the half of the bug - unclickable even
    // where it showed - that paint order alone does not cover.
    await userEvent.click(second);
    await flush();

    expect(trigger().value).toBe('Second');
  });
});
