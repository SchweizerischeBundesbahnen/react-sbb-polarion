import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import SearchableSelect, { type SelectOption } from '../src/components/SearchableSelect';
import SearchableDropdown from '../src/generic/SearchableDropdown.js';
import { mousedown } from './helpers';

// Opening focuses the search box, whose blinking caret changes pixels every frame and prevents
// toMatchScreenshot from ever settling on a stable frame. Hide the caret so open-list captures are
// deterministic (it is not visible in a static reference regardless).
beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = 'input { caret-color: transparent !important; }';
  document.head.appendChild(style);
});

// Visual-regression states for the searchable dropdown. Kept SEPARATE from the behavior tests on
// purpose: any file with toMatchScreenshot only matches in Docker (font antialiasing differs on
// Windows/macOS), so isolating the screenshots here keeps the behavior suites passing everywhere.
// References live in test/expected/ and MUST be generated in Docker (npm run test:update:docker).
//
// Most states are rendered via the vendored class into a .sbb-ui host - the appearance is identical
// whether entered through the React <SearchableSelect> wrapper or the class, so those stay uniform and
// React-free. Closed states screenshot the host; open states screenshot the .sd-portal. The last group
// is the exception: the two rules SearchableSelect.css owns live in the wrapper's own stylesheet, which
// only loads when the component is imported, so those states render the React component.

// SBB-red rounded square, url-encoded so it is safe as an <img> data: URI (stable, no network).
const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' rx='3' fill='%23eb0000'/%3E%3C/svg%3E";

type Opt = { value: string; label: string; icon?: string; selected?: boolean };

const makeSelect = (opts: Opt[], { multiple = false, disabled = false } = {}): HTMLSelectElement => {
  const select = document.createElement('select');
  select.multiple = multiple;
  select.disabled = disabled;
  for (const o of opts) {
    const option = document.createElement('option');
    option.value = o.value;
    option.text = o.label;
    option.selected = !!o.selected;
    if (o.icon) option.setAttribute('data-icon', o.icon);
    select.appendChild(option);
  }
  return select;
};

const host = (testid: string, el: HTMLElement): HTMLDivElement => {
  const h = document.createElement('div');
  h.className = 'sbb-ui visual-host';
  h.setAttribute('data-testid', testid);
  h.style.width = '240px';
  h.style.padding = '16px';
  h.appendChild(el);
  document.body.appendChild(h);
  return h;
};

// Capture the popup's inner content (search box + option list), NOT the `.sd-portal` wrapper: the
// wrapper is `position: fixed`, which Playwright's locator.screenshot cannot stabilise (it times out),
// whereas this in-flow child screenshots cleanly like the closed-state hosts do.
const popupContent = () => document.querySelector('.sd-portal .options') as HTMLElement;

// Open the popup and detach the dropdown's scroll/resize reposition listeners so Playwright's
// scroll-into-view can't fire the capture-phase handler and move the popup mid-capture.
const openStable = (dd: SearchableDropdown) => {
  mousedown(dd.trigger);
  window.removeEventListener('scroll', dd._repositionHandler, true);
  window.removeEventListener('resize', dd._repositionHandler);
};

afterEach(() => {
  document.querySelectorAll('.visual-host, .sd-portal').forEach((el) => el.remove());
});

const AB: Opt[] = [
  { value: 'a', label: 'First' },
  { value: 'b', label: 'Second' },
];
const ABC: Opt[] = [...AB, { value: 'c', label: 'Third' }];
const AB_ICONS: Opt[] = [
  { value: 'a', label: 'First', icon: ICON },
  { value: 'b', label: 'Second', icon: ICON },
];

describe.skipIf(!__PIXEL_REFERENCES__)('SearchableSelect visual states - closed control', () => {
  it('default (first option selected)', async () => {
    const select = makeSelect(AB);
    host('default', select);
    new SearchableDropdown({ element: select, rememberSelection: false });
    await expect(page.getByTestId('default')).toMatchScreenshot('searchable-select-default');
  });

  it('selected + disabled', async () => {
    const select = makeSelect(AB, { disabled: true });
    host('single-selected-disabled', select);
    new SearchableDropdown({ element: select, rememberSelection: false });
    await expect(page.getByTestId('single-selected-disabled')).toMatchScreenshot('single-selected-disabled');
  });

  it('empty (allowEmpty) + disabled', async () => {
    const select = makeSelect(AB, { disabled: true });
    host('single-empty-disabled', select);
    new SearchableDropdown({ element: select, allowEmpty: true, placeholder: 'Select…', rememberSelection: false });
    await expect(page.getByTestId('single-empty-disabled')).toMatchScreenshot('single-empty-disabled');
  });

  it('with option icon', async () => {
    const select = makeSelect(AB_ICONS);
    host('single-with-icon', select);
    new SearchableDropdown({ element: select, rememberSelection: false });
    await expect(page.getByTestId('single-with-icon')).toMatchScreenshot('single-with-icon');
  });

  it('with option icon + disabled', async () => {
    const select = makeSelect(AB_ICONS, { disabled: true });
    host('single-with-icon-disabled', select);
    new SearchableDropdown({ element: select, rememberSelection: false });
    await expect(page.getByTestId('single-with-icon-disabled')).toMatchScreenshot('single-with-icon-disabled');
  });

  it('multi-select chips', async () => {
    const select = makeSelect(ABC, { multiple: true });
    host('multi-chips', select);
    const dd = new SearchableDropdown({ element: select, multiselect: true, rememberSelection: false });
    dd.selectMultipleValues(['a', 'b']);
    await expect(page.getByTestId('multi-chips')).toMatchScreenshot('multi-chips');
  });

  it('multi-select + disabled', async () => {
    const select = makeSelect([{ value: 'a', label: 'First', selected: true }, ...ABC.slice(1)], {
      multiple: true,
      disabled: true,
    });
    host('multi-disabled', select);
    new SearchableDropdown({ element: select, multiselect: true, rememberSelection: false });
    await expect(page.getByTestId('multi-disabled')).toMatchScreenshot('multi-disabled');
  });
});

describe.skipIf(!__PIXEL_REFERENCES__)('SearchableSelect visual states - open list', () => {
  it('single-select open list', async () => {
    const select = makeSelect(ABC);
    host('single-open', select);
    const dd = new SearchableDropdown({ element: select, rememberSelection: false });
    openStable(dd);
    await expect(page.elementLocator(popupContent())).toMatchScreenshot('single-open-list');
  });

  it('multi-select open list (checkboxes)', async () => {
    const select = makeSelect(ABC, { multiple: true });
    host('multi-open', select);
    const dd = new SearchableDropdown({ element: select, multiselect: true, rememberSelection: false });
    openStable(dd);
    await expect(page.elementLocator(popupContent())).toMatchScreenshot('multi-open-list');
  });

  it('open list with option icons', async () => {
    const select = makeSelect(AB_ICONS);
    host('icons-open', select);
    const dd = new SearchableDropdown({ element: select, rememberSelection: false });
    openStable(dd);
    await expect(page.elementLocator(popupContent())).toMatchScreenshot('options-with-icons-open-list');
  });
});

// Deliberately-too-long values, in a dedicated group so they fixate overflow/truncation behavior without
// muddying the plain-state references above. The host stays 240px wide so the value cannot fit.
const LONG =
  'Third - a deliberately long option label that cannot fit within the control width, extended much further with extra filler words so that even at the 1280 by 720 desktop viewport the popup grows far wider than the screen and the captured reference is deliberately clipped at the right edge';

describe.skipIf(!__PIXEL_REFERENCES__)('SearchableSelect visual states - long values / overflow', () => {
  it('closed trigger with a long selected value', async () => {
    const select = makeSelect([
      { value: 'a', label: 'First' },
      { value: 'b', label: 'Second' },
      { value: 'c', label: LONG, selected: true },
    ]);
    host('single-overflow', select);
    new SearchableDropdown({ element: select, rememberSelection: false });
    await expect(page.getByTestId('single-overflow')).toMatchScreenshot('single-overflow-value');
  });

  // NOTE: this reference is intentionally ugly, and that is the point. The popup uses
  // `width: max-content`, so the long option makes it ~1770px wide, far past the 1280px viewport;
  // `_position()` shifts it to x=4 but it still overflows the right edge. Because the popup is
  // `position: fixed`, the browser never paints the part beyond the viewport, so the captured PNG
  // (~1771 x 120, the full popup box) shows the label painted only to x~1275 (the viewport edge) with
  // a blank white band from there to ~1771. So we are fixating a capture/paint artifact of an
  // over-wide fixed popup, NOT a component truncation: the text is laid out in full, no ellipsis. It
  // is kept deliberately so that if the popup later gains a sane max-width / ellipsis, this reference
  // flips and forces a review. Numbers are the actual measured values at generation time
  // (viewport 1280 x 720, popup 1770px, image 1771px wide, content to x~1275).
  it('open list containing a long option (deliberately clipped - see note above)', async () => {
    const select = makeSelect([
      { value: 'a', label: 'First' },
      { value: 'b', label: LONG },
      { value: 'c', label: 'Third' },
    ]);
    host('single-overflow-open', select);
    const dd = new SearchableDropdown({ element: select, rememberSelection: false });
    openStable(dd);
    await expect(page.elementLocator(popupContent())).toMatchScreenshot('single-overflow-open-list');
  });

  it('multi-select chip with a long value', async () => {
    const select = makeSelect(
      [
        { value: 'a', label: 'First' },
        { value: 'c', label: LONG },
      ],
      { multiple: true },
    );
    host('multi-overflow', select);
    const dd = new SearchableDropdown({ element: select, multiselect: true, rememberSelection: false });
    dd.selectMultipleValues(['a', 'c']);
    await expect(page.getByTestId('multi-overflow')).toMatchScreenshot('multi-overflow-chip');
  });

  it('editable trigger seeded with a long value', async () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = LONG;
    host('editable-overflow', input);
    new SearchableDropdown({
      element: input,
      editable: true,
      items: [{ value: 'x', label: 'X' }],
      rememberSelection: false,
    });
    await expect(page.getByTestId('editable-overflow')).toMatchScreenshot('editable-overflow-value');
  });
});

// The two states styled by SearchableSelect.css, the wrapper's own stylesheet. They render the React
// component, because importing it is what loads that stylesheet.
const DECORATED: SelectOption[] = [
  { id: 'a', name: 'Parent', iconURL: ICON },
  { id: 'b', name: 'Child', iconURL: ICON, indent: true },
  { id: 'c', name: 'Another parent' },
];

// The dropdown keeps a backreference on the element it wrapped, which is how a React-rendered control
// reaches its instance for openStable().
const instanceOf = (select: HTMLSelectElement) =>
  (select as HTMLSelectElement & { _searchableDropdown: SearchableDropdown })._searchableDropdown;

describe.skipIf(!__PIXEL_REFERENCES__)('SearchableSelect visual states - wrapper stylesheet', () => {
  afterEach(cleanup);

  it('open list with an indented child option', async () => {
    render(
      <div className="sbb-ui visual-host" style={{ width: 240, padding: 16 }}>
        <SearchableSelect value="a" onChange={() => {}} options={DECORATED} />
      </div>,
    );
    await vi.waitFor(() => expect(document.querySelector('.searchable-dropdown .sd-trigger')).not.toBeNull());
    openStable(instanceOf(document.querySelector('select')!));
    await expect(page.elementLocator(popupContent())).toMatchScreenshot('indented-option-open-list');
  });

  it('multi-select chips in a flex row keep the trailing control visible', async () => {
    // Fixates the min-width guard: without it the chips box keeps the width of its widest chip and
    // pushes the button out of the row, which is the regression the rule exists for.
    render(
      <div className="sbb-ui visual-host" data-testid="multi-flex-row" style={{ width: 240, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <SearchableSelect
            multiple
            value={['a', 'c']}
            onChange={() => {}}
            options={[
              { id: 'a', name: 'First' },
              { id: 'c', name: LONG },
            ]}
          />
          <button type="button" style={{ flex: '0 0 auto' }}>
            ...
          </button>
        </div>
      </div>,
    );
    await vi.waitFor(() => expect(document.querySelectorAll('.sd-chip').length).toBe(2));
    await expect(page.getByTestId('multi-flex-row')).toMatchScreenshot('multi-in-flex-row');
  });
});
