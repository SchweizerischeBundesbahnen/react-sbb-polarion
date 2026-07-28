import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { parkPointer } from './helpers';

// There is no Checkbox component: the 2606 look is applied by checkboxes.css + the --sbb-checkbox-*
// tokens to a plain <input type="checkbox"> when it sits inside one of the scope wrappers the CSS
// targets (.standard-admin-page / .modal__container / .form-wrapper). So we render a bare checkbox in
// such a host and screenshot each styled state. The glyph is an inline SVG background image, so it is
// deterministic. checkboxes.css styles three base states (unchecked / checked / indeterminate), each
// also in a :disabled (read-only grey) and a :focus-visible (keyboard-focus) variant = 9 states. There
// is no :hover rule, so no hover state. `:focus-visible` only matches on keyboard focus, so the focus
// states Tab to the control rather than calling .focus().

type State = { checked?: boolean; disabled?: boolean; indeterminate?: boolean };

function mount(state: State): HTMLInputElement {
  const host = document.createElement('div');
  host.className = 'sbb-ui standard-admin-page checkbox-host';
  host.style.padding = '8px';
  host.style.width = 'max-content';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!state.checked;
  input.disabled = !!state.disabled;
  host.appendChild(input);
  document.body.appendChild(host);
  input.indeterminate = !!state.indeterminate; // DOM property (no attribute); set after insertion
  return input;
}

afterEach(() => {
  document.querySelectorAll('.checkbox-host').forEach((el) => el.remove());
});

const shot = async (input: HTMLInputElement, name: string) => {
  await parkPointer();
  return expect(page.elementLocator(input)).toMatchScreenshot(name);
};

describe.skipIf(!__PIXEL_REFERENCES__)('Checkbox visual states', () => {
  it('unchecked', async () => {
    await shot(mount({}), 'checkbox-unchecked');
  });

  it('checked', async () => {
    await shot(mount({ checked: true }), 'checkbox-checked');
  });

  it('indeterminate', async () => {
    await shot(mount({ indeterminate: true }), 'checkbox-indeterminate');
  });

  it('disabled unchecked', async () => {
    await shot(mount({ disabled: true }), 'checkbox-disabled-unchecked');
  });

  it('disabled checked', async () => {
    await shot(mount({ checked: true, disabled: true }), 'checkbox-disabled-checked');
  });

  it('disabled indeterminate', async () => {
    await shot(mount({ indeterminate: true, disabled: true }), 'checkbox-disabled-indeterminate');
  });

  it('focus-visible unchecked', async () => {
    const input = mount({});
    await userEvent.tab(); // keyboard focus so :focus-visible matches
    await shot(input, 'checkbox-focus-unchecked');
  });

  it('focus-visible checked', async () => {
    const input = mount({ checked: true });
    await userEvent.tab();
    await shot(input, 'checkbox-focus-checked');
  });

  it('focus-visible indeterminate', async () => {
    const input = mount({ indeterminate: true });
    await userEvent.tab();
    await shot(input, 'checkbox-focus-indeterminate');
  });
});
