import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import DateInput from '../src/components/DateInput';
import DateRangePicker from '../src/components/DateRangePicker';
import SearchableSelect from '../src/components/SearchableSelect';
import { parkPointer } from './helpers';

// Visual-regression states for the date field. Kept separate from the behavior tests (Docker-only,
// since any toMatchScreenshot file diffs on non-Linux font antialiasing). References live in
// test/expected/DateInput/ and MUST be generated in Docker (npm run test:update:docker).
//
// The point of this component is that a date stops looking like the browser's own control, so the
// states worth fixating are the resting look, the disabled one, the labelled range, and - the reason
// the component exists - a date standing next to the other controls in one row.

// A focused date field blinks its caret between the day/month/year segments, which never settles for
// toMatchScreenshot. Nothing here focuses one, but the rule costs nothing and keeps a capture stable
// if a later state does.
beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = 'input { caret-color: transparent !important; }';
  document.head.appendChild(style);
});

const host = (testid: string, children: React.ReactNode, width = 420) =>
  render(
    <div className="sbb-ui visual-host" data-testid={testid} style={{ width, padding: 16 }}>
      {children}
    </div>,
  );

const shot = async (testid: string, name: string) => {
  await vi.waitFor(() => expect(document.querySelectorAll('input[type="date"]').length).toBeGreaterThan(0));
  await parkPointer();
  return expect(page.getByTestId(testid)).toMatchScreenshot(name);
};

afterEach(cleanup);

describe.skipIf(!__PIXEL_REFERENCES__)('DateInput visual states', () => {
  it('a filled field with its label', async () => {
    host('date-labelled', <DateInput label="Valid from" value="2026-06-01" onChange={() => {}} />);
    await shot('date-labelled', 'date-labelled');
  });

  it('an empty field, no label', async () => {
    host('date-empty', <DateInput value="" onChange={() => {}} />);
    await shot('date-empty', 'date-empty');
  });

  it('a disabled field', async () => {
    host('date-disabled', <DateInput label="Valid from" value="2026-06-01" onChange={() => {}} disabled />);
    await shot('date-disabled', 'date-disabled');
  });

  it('the range, both ends set', async () => {
    host(
      'date-range',
      <DateRangePicker start="2026-06-01" end="2026-06-30" onStartChange={() => {}} onEndChange={() => {}} />,
    );
    await shot('date-range', 'date-range');
  });

  // The regression this component exists for: next to a combobox and a button, the browser's own date
  // box is taller, rounded and in the system font, and the row reads as three unrelated controls.
  it('the range in a control row, next to a select and a button', async () => {
    host(
      'date-in-row',
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div className="sbb-date-field">
          <label htmlFor="visual-scope">Scope</label>
          <SearchableSelect
            id="visual-scope"
            value="a"
            onChange={() => {}}
            options={[
              { id: 'a', name: 'Repository' },
              { id: 'b', name: 'elibrary' },
            ]}
          />
        </div>
        <DateRangePicker start="2026-06-01" end="2026-06-30" onStartChange={() => {}} onEndChange={() => {}} />
        <button type="button" className="sbb-btn sbb-btn--control">
          <span>Export</span>
        </button>
      </div>,
      540,
    );
    await vi.waitFor(() => expect(document.querySelector('.searchable-dropdown .sd-trigger')).not.toBeNull());
    await shot('date-in-row', 'date-in-a-control-row');
  });
});
