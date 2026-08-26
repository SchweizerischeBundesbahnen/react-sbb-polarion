import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import DateInput from '../src/components/DateInput';
import DateRangePicker from '../src/components/DateRangePicker';

// Behavior tests for the date field and the period it composes into. The appearance - the control
// height, border and font that make a date sit in a row of Polarion controls - is covered in
// DateInput.visual.test.tsx.

const inputs = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
const only = () => inputs()[0];
const labels = () => Array.from(document.querySelectorAll('.sbb-date-field > label')).map((l) => l.textContent);
// The render commits asynchronously, so each one is awaited on the fields it produces.
const ready = (count = 1) => vi.waitFor(() => expect(inputs()).toHaveLength(count));

afterEach(cleanup);

describe('DateInput', () => {
  it('shows the value and reports what the user picks', async () => {
    const onChange = vi.fn();
    render(
      <div className="sbb-ui">
        <DateInput value="2026-06-01" onChange={onChange} />
      </div>,
    );
    await ready();

    expect(only().value).toBe('2026-06-01');
    await userEvent.fill(only(), '2026-06-10');
    expect(onChange).toHaveBeenCalledWith('2026-06-10');
  });

  it('ties its label to the input, with a generated id when none is given', async () => {
    render(
      <div className="sbb-ui">
        <DateInput label="Due date" value="" onChange={() => {}} />
      </div>,
    );
    await ready();

    const label = document.querySelector<HTMLLabelElement>('.sbb-date-field > label');
    expect(label?.textContent).toBe('Due date');
    expect(label?.htmlFor).toBe(only().id);
    expect(only().id).not.toBe('');
  });

  it('keeps the id it is given, for a form that already names the field', async () => {
    render(
      <div className="sbb-ui">
        <DateInput id="valid-from" label="Valid from" value="" onChange={() => {}} />
      </div>,
    );
    await ready();

    expect(only().id).toBe('valid-from');
    expect(document.querySelector<HTMLLabelElement>('.sbb-date-field > label')?.htmlFor).toBe('valid-from');
  });

  it('renders no label element when there is nothing to label', async () => {
    render(
      <div className="sbb-ui">
        <DateInput value="" onChange={() => {}} />
      </div>,
    );
    await ready();

    expect(document.querySelector('.sbb-date-field > label')).toBeNull();
  });

  it('passes the bounds through, and treats an empty one as unbounded', async () => {
    render(
      <div className="sbb-ui">
        <DateInput value="" onChange={() => {}} min="2026-01-01" max="" />
      </div>,
    );
    await ready();

    // An empty string is not a valid min/max, so the component renders no attribute at all. The
    // property reads '' either way - only the attribute tells the two apart, so that is what is
    // asserted here.
    expect(only().min).toBe('2026-01-01');
    expect(only().hasAttribute('max')).toBe(false);
  });

  it('renders disabled with the reason as its tooltip', async () => {
    render(
      <div className="sbb-ui">
        <DateInput value="2026-06-01" onChange={() => {}} disabled title="Pick a scope first" />
      </div>,
    );
    await ready();

    expect(only().disabled).toBe(true);
    expect(only().title).toBe('Pick a scope first');
  });

  it('wears the control look rather than the browser default', async () => {
    render(
      <div className="sbb-ui">
        <DateInput value="2026-06-01" onChange={() => {}} />
      </div>,
    );
    await ready();

    // The three the browser default gets wrong, and the reason a date used to break a control row:
    // it is taller, rounded and in the system font.
    const style = getComputedStyle(only());
    expect(style.height).toBe('23px');
    expect(style.borderRadius).toBe('0px');
    expect(style.fontFamily).toContain('Segoe UI');
  });
});

describe('DateRangePicker', () => {
  function Controlled(props: Readonly<{ initialStart?: string; initialEnd?: string; min?: string; max?: string }>) {
    const [start, setStart] = useState(props.initialStart ?? '');
    const [end, setEnd] = useState(props.initialEnd ?? '');
    return (
      <div className="sbb-ui">
        <DateRangePicker
          start={start}
          end={end}
          onStartChange={setStart}
          onEndChange={setEnd}
          min={props.min}
          max={props.max}
        />
      </div>
    );
  }

  it('bounds each end of the range by the other', async () => {
    render(<Controlled initialStart="2026-06-01" initialEnd="2026-06-30" />);
    await ready(2);

    const [from, to] = inputs();
    expect(from.max).toBe('2026-06-30');
    expect(to.min).toBe('2026-06-01');
  });

  it('leaves both ends unbounded while the range is empty', async () => {
    render(<Controlled />);
    await ready(2);

    const [from, to] = inputs();
    expect(from.max).toBe('');
    expect(to.min).toBe('');
  });

  it('re-bounds the other end as soon as one is picked', async () => {
    render(<Controlled />);
    await ready(2);

    await userEvent.fill(inputs()[0], '2026-06-10');
    await vi.waitFor(() => expect(inputs()[1].min).toBe('2026-06-10'));
    expect(inputs()[0].max).toBe('');
  });

  it('keeps the outer bounds where the inner one does not apply', async () => {
    render(<Controlled initialStart="2026-06-01" min="2026-01-01" max="2026-12-31" />);
    await ready(2);

    const [from, to] = inputs();
    expect(from.min).toBe('2026-01-01');
    // The end is open, so the start keeps the outer maximum...
    expect(from.max).toBe('2026-12-31');
    // ...while the end starts from the picked start rather than the outer minimum.
    expect(to.min).toBe('2026-06-01');
    expect(to.max).toBe('2026-12-31');
  });

  it('labels the two ends From / To', async () => {
    render(<Controlled />);
    await ready(2);

    expect(labels()).toEqual(['From', 'To']);
  });

  it('takes other words for the labels', async () => {
    render(
      <div className="sbb-ui">
        <DateRangePicker
          start=""
          end=""
          onStartChange={() => {}}
          onEndChange={() => {}}
          startLabel="Valid from"
          endLabel="Valid to"
        />
      </div>,
    );
    await ready(2);

    expect(labels()).toEqual(['Valid from', 'Valid to']);
  });

  it('disables both ends together', async () => {
    render(
      <div className="sbb-ui">
        <DateRangePicker start="" end="" onStartChange={() => {}} onEndChange={() => {}} disabled />
      </div>,
    );
    await ready(2);

    expect(inputs().map((i) => i.disabled)).toEqual([true, true]);
  });
});
