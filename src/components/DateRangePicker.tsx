import DateInput from './DateInput';
import './DateInput.css';

export interface DateRangePickerProps {
  /** The two ends as `yyyy-MM-dd`; an empty string is an open end. */
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  /** Labels above the fields. Pass empty strings for a bare, unlabelled row. */
  startLabel?: string;
  endLabel?: string;
  /** Bounds for the range as a whole, e.g. a period that cannot start before the project did. */
  min?: string;
  max?: string;
  disabled?: boolean;
}

/**
 * The two ends of a period, as one control: two `DateInput`s that bound each other, so the calendar
 * of the start never offers a day after the end and the calendar of the end never offers a day before
 * the start. That pairing is what every extension with a period filter was writing by hand.
 *
 * `min` / `max` bound the range from the outside; the inner bound wins whenever an end is set, which
 * keeps both rules true at once. An open end simply leaves the other one free.
 */
export default function DateRangePicker({
  start,
  end,
  onStartChange,
  onEndChange,
  startLabel = 'From',
  endLabel = 'To',
  min,
  max,
  disabled = false,
}: Readonly<DateRangePickerProps>) {
  return (
    <div className="sbb-date-range">
      <DateInput
        label={startLabel}
        value={start}
        onChange={onStartChange}
        min={min}
        max={end || max}
        disabled={disabled}
      />
      <DateInput label={endLabel} value={end} onChange={onEndChange} min={start || min} max={max} disabled={disabled} />
    </div>
  );
}
