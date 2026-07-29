import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfigurationButtons from '../src/components/ConfigurationButtons';

// Behavior tests for the shared ConfigurationButtons toolbar (screenshot-free, so they run on Windows
// and Docker alike). Appearance (the gray bar + control buttons) is covered in
// ConfigurationButtons.visual.test.tsx. Rendered via createRoot + flushSync (synchronous component, no
// async load), matching the Modal tests, so assertions run right after the render.

const q = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`not found: ${sel}`);
  return el;
};
const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.action-buttons .sbb-btn'));
const byLabel = (label: string): HTMLButtonElement => {
  const found = buttons().find((b) => (b.textContent ?? '').trim() === label);
  if (!found) throw new Error(`button not found: ${label}`);
  return found;
};

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function teardown() {
  if (root) {
    flushSync(() => root!.unmount());
    root = undefined;
  }
  container?.remove();
  container = undefined;
}

afterEach(teardown);

function renderButtons(
  overrides: {
    onSave?: () => void;
    onCancel?: () => void;
    onRevertToDefault?: () => void;
    onToggleRevisions?: () => void;
    revisionsShown?: boolean;
    /** Render without onRevertToDefault so the Default button is hidden. */
    omitDefault?: boolean;
  } = {},
) {
  teardown();
  const onSave = overrides.onSave ?? vi.fn();
  const onCancel = overrides.onCancel ?? vi.fn();
  const onRevertToDefault = overrides.omitDefault ? undefined : (overrides.onRevertToDefault ?? vi.fn());
  const onToggleRevisions = overrides.onToggleRevisions ?? vi.fn();
  container = document.createElement('div');
  container.className = 'sbb-ui';
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => {
    root!.render(
      <ConfigurationButtons
        onSave={onSave}
        onCancel={onCancel}
        onRevertToDefault={onRevertToDefault}
        onToggleRevisions={onToggleRevisions}
        revisionsShown={overrides.revisionsShown}
      />,
    );
  });
  return { onSave, onCancel, onRevertToDefault, onToggleRevisions };
}

describe('ConfigurationButtons', () => {
  it('renders the four toolbar buttons in order on the gray actions-pane bar', () => {
    renderButtons();
    expect(q('.actions-pane')).toBeInTheDocument();
    expect(buttons().map((b) => (b.textContent ?? '').trim())).toEqual(['Save', 'Cancel', 'Default', 'Revisions']);
  });

  it('hides the Default button when onRevertToDefault is not provided', () => {
    renderButtons({ omitDefault: true });
    expect(buttons().map((b) => (b.textContent ?? '').trim())).toEqual(['Save', 'Cancel', 'Revisions']);
    expect(document.querySelector('.sbb-icon-revert')).toBeNull();
  });

  it('renders each button with its .sbb-icon-* glyph', () => {
    renderButtons();
    expect(byLabel('Save').querySelector('.sbb-icon-save')).not.toBeNull();
    expect(byLabel('Cancel').querySelector('.sbb-icon-cancel')).not.toBeNull();
    expect(byLabel('Default').querySelector('.sbb-icon-revert')).not.toBeNull();
    expect(byLabel('Revisions').querySelector('.sbb-icon-select-revision')).not.toBeNull();
  });

  it('fires onSave when Save is clicked', () => {
    const { onSave, onCancel, onRevertToDefault, onToggleRevisions } = renderButtons();
    byLabel('Save').click();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onRevertToDefault).not.toHaveBeenCalled();
    expect(onToggleRevisions).not.toHaveBeenCalled();
  });

  it('fires onCancel when Cancel is clicked', () => {
    const { onCancel } = renderButtons();
    byLabel('Cancel').click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('fires onRevertToDefault when Default is clicked', () => {
    const { onRevertToDefault } = renderButtons();
    byLabel('Default').click();
    expect(onRevertToDefault).toHaveBeenCalledTimes(1);
  });

  it('fires onToggleRevisions when Revisions is clicked', () => {
    const { onToggleRevisions } = renderButtons();
    byLabel('Revisions').click();
    expect(onToggleRevisions).toHaveBeenCalledTimes(1);
  });

  it('reflects revisionsShown on the Revisions button aria-pressed', () => {
    renderButtons({ revisionsShown: false });
    expect(byLabel('Revisions').getAttribute('aria-pressed')).toBe('false');
    renderButtons({ revisionsShown: true });
    expect(byLabel('Revisions').getAttribute('aria-pressed')).toBe('true');
  });

  it('exposes the tooltip titles matching the legacy admin toolbar', () => {
    renderButtons();
    // On the button, like the other three - not on the icon span, so the tooltip covers the whole
    // control rather than just the glyph.
    expect(byLabel('Save').getAttribute('title')).toBe('Save data');
    expect(byLabel('Cancel').getAttribute('title')).toBe('Cancel editing and revert to last persisted state');
    expect(byLabel('Default').getAttribute('title')).toBe('Load default values');
    expect(byLabel('Revisions').getAttribute('title')).toBe('Toggle list of revisions');
  });
});
