import { useEffect, useRef } from 'react';
import { type SearchableDropdownInstance, createSearchableSelect } from '../generic/searchableSelect.js';

export interface SelectOption {
  id: string;
  name: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  /** Optional id set on the underlying <select> (some legacy per-extension CSS targets the control by id). */
  id?: string;
}

/**
 * Renders a React-controlled native <select> and upgrades it to the shared Polarion
 * SearchableDropdown. The dropdown factory is the generic vanilla-JS module, copied into this library
 * (see ../generic/searchableSelect.js) and **bundled** - imported directly, no runtime fetch from the
 * Polarion-served generic modules. The <select> stays the source of truth; the dropdown mirrors the
 * selection back and dispatches `change`. Falls back to the plain <select> if creation throws.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = '',
  allowEmpty = false,
  disabled = false,
  id,
}: SearchableSelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const sdRef = useRef<SearchableDropdownInstance | null>(null);

  useEffect(() => {
    const element = selectRef.current;
    if (!element) return;
    try {
      sdRef.current = createSearchableSelect(element, { allowEmpty, placeholder });
      // Apply the current value right after creation. With `allowEmpty`, the dropdown resets to
      // unselected on init (it only honors an option's `selected` HTML attribute, which a React
      // controlled <select> never sets), so a component mounting with a preset value and all options
      // already present (e.g. a mapping row re-created with a fresh key after save/reload) would show
      // a blank trigger without this.
      sdRef.current?.selectValue(value);
    } catch {
      /* keep the native <select> */
    }
    return () => {
      if (sdRef.current) {
        sdRef.current.destroy();
        sdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the dropdown trigger in sync when the value is driven from React state (option changes are
  // picked up by SearchableDropdown's own MutationObserver).
  useEffect(() => {
    sdRef.current?.selectValue(value);
  }, [value]);

  return (
    <select id={id} ref={selectRef} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {/* Empty state: the SearchableDropdown's own `allowEmpty` shows the placeholder as ghost text in
          the trigger and never auto-selects the first option. This empty <option> is kept in the DOM
          only so React can bind value="" (and the native fallback works), but hidden with display:none
          so the dropdown filters it out of the list (it skips display:none options) - it is NOT a
          selectable "Select…" item. */}
      {allowEmpty && <option value="" style={{ display: 'none' }} />}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
