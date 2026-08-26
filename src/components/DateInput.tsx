import { useId } from 'react';
import './DateInput.css';

export interface DateInputProps {
  /** The date as `yyyy-MM-dd` (what a native date input reads and writes). Empty string = no date. */
  value: string;
  onChange: (value: string) => void;
  /** Rendered above the field. Without it the field is the input alone. */
  label?: string;
  /** Earliest / latest selectable date, `yyyy-MM-dd`. An empty string means unbounded. */
  min?: string;
  max?: string;
  disabled?: boolean;
  /** Set when the surrounding form already has an id for the field; otherwise one is generated. */
  id?: string;
  /** Native tooltip, e.g. the reason a field is disabled. */
  title?: string;
}

/**
 * A single date field: the native `<input type="date">` - so it keeps the platform's own calendar
 * popup, keyboard entry and locale-formatted display - wearing the Polarion control look of every
 * other input in this library (see DateInput.css).
 *
 * The value is the ISO `yyyy-MM-dd` string the input itself uses, never a `Date`: that is what the
 * REST settings carry, and it avoids the timezone shift a `Date` round-trip introduces.
 *
 * An empty `min` / `max` is passed as no bound at all. A consuming form usually holds "no date yet" as
 * an empty string, and forwarding that verbatim would make the attribute invalid and silently drop the
 * other bound too.
 */
export default function DateInput({
  value,
  onChange,
  label,
  min,
  max,
  disabled = false,
  id,
  title,
}: Readonly<DateInputProps>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="sbb-date-field">
      {label && <label htmlFor={inputId}>{label}</label>}
      <input
        id={inputId}
        className="sbb-date-input"
        type="date"
        value={value}
        min={min || undefined}
        max={max || undefined}
        disabled={disabled}
        title={title}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
