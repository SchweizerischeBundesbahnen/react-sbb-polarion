import { useEffect, useRef } from 'react';
import { type SearchableDropdownInstance, createSearchableSelect } from '../generic/searchableSelect.js';
import './SearchableSelect.css';

export interface SelectOption {
  id: string;
  name: string;
  /** Per-option icon, shown in the popup, on the trigger and (multi-select) on the chip. */
  iconURL?: string;
  /** Colored tile painted behind the icon, e.g. a work item type color. */
  iconBg?: string;
  /** Indents the option, for a child entry listed under its parent option. */
  indent?: boolean;
  /**
   * Marks the option as inherited from a broader (e.g. global) scope, the way generic marks a config
   * of the global level: the name in normal weight with a small italic "global" marker on the right,
   * while the options of the current scope turn bold. The trigger is an <input> and cannot render the
   * marker, so a selected inherited option shows just its name there.
   */
  inherited?: boolean;
}

interface BaseProps {
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Renders the control disabled, for an option list that is still loading. */
  loading?: boolean;
  /** Shows the search box in the popup. Pass false for a short list, where filtering is only noise. */
  searchable?: boolean;
  /** Optional id set on the underlying <select> (some legacy per-extension CSS targets the control by id). */
  id?: string;
}

export interface SingleSelectProps extends BaseProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}

export interface MultiSelectProps extends BaseProps {
  multiple: true;
  value: string[];
  onChange: (values: string[]) => void;
}

export type SearchableSelectProps = SingleSelectProps | MultiSelectProps;

/** Display flags of an option, as the classes the dropdown mirrors onto the rendered popup option
 *  (preserveOptionClasses). `parent` is the shared generic class for an inherited config. */
function optionClass(option: SelectOption): string | undefined {
  const classes = [option.indent && 'indented', option.inherited && 'parent'].filter(Boolean);
  return classes.length > 0 ? classes.join(' ') : undefined;
}

/** The selection as a list in both modes: multi-select passes one through, single-select wraps its
 *  value, and an empty single-select value is no selection rather than a selection of "". */
function toValues(props: SearchableSelectProps): string[] {
  if (props.multiple) return props.value;
  return props.value ? [props.value] : [];
}

/**
 * Renders a React-controlled native <select> and upgrades it to the shared Polarion
 * SearchableDropdown. The dropdown factory is the generic vanilla-JS module, copied into this library
 * (see ../generic/searchableSelect.js) and **bundled** - imported directly, no runtime fetch from the
 * Polarion-served generic modules. The <select> stays the source of truth; the dropdown mirrors the
 * selection back and dispatches `change`. Falls back to the plain <select> if creation throws.
 *
 * `multiple` switches the same control to multi-select: checkbox options in the popup and one removable
 * chip per selection on the trigger. It changes the shape of `value` / `onChange` (a string list instead
 * of a string), which is why the two modes are separate prop types over one component.
 */
export default function SearchableSelect(props: Readonly<SearchableSelectProps>) {
  const { options, placeholder = '', disabled = false, loading = false, searchable = true, id } = props;
  const multiple = props.multiple === true;
  // allowEmpty is meaningless for a multi-select: no selection is already a valid state there.
  const allowEmpty = props.multiple ? false : props.allowEmpty === true;

  // One internal shape for both modes: a selection is a list, and single-select is a list of at most
  // one. These two lines are where the mode is read, so the effects and the change handler below have no
  // branch at all and the render branches only where the DOM itself differs. The eventual move of the
  // dropdown's logic into this file inherits the same shape.
  const values = toValues(props);
  const emit = props.multiple ? props.onChange : (next: string[]) => props.onChange(next[0] ?? '');

  const selectRef = useRef<HTMLSelectElement>(null);
  const sdRef = useRef<SearchableDropdownInstance | null>(null);

  // Mirror the current selection onto the wrapped <select>, then let the dropdown re-read it. This is
  // the one sync path for both modes: `selected` flags are how a native <select> carries a selection
  // either way, and syncFromElement() repaints the trigger (chips in multi-select mode) without firing
  // a change event back into React.
  //
  // Deliberately not selectValue() / selectMultipleValues(): the former is single-select only, and the
  // latter updates the dropdown's own item list but NOT the wrapped <select>, which would leave the two
  // disagreeing about what is selected.
  const applySelection = () => {
    const element = selectRef.current;
    if (!element || !sdRef.current) return;
    const selected = new Set(values);
    for (const option of Array.from(element.options)) {
      option.selected = selected.has(option.value);
    }
    sdRef.current.syncFromElement();
  };

  // The dropdown bakes its mode in at construction time, so `multiple` is part of this instance's
  // identity: flipping the prop rebuilds the control instead of silently keeping the previous mode.
  useEffect(() => {
    const element = selectRef.current;
    if (!element) return;
    try {
      sdRef.current = createSearchableSelect(element, { multiselect: multiple, allowEmpty, placeholder, searchable });
      // Apply the current selection right after creation. The dropdown only honors an option's
      // `selected` HTML attribute, which a React controlled <select> never sets, and with `allowEmpty`
      // it actively resets to unselected on init - so a component mounting with a preset value and all
      // options already present (e.g. a mapping row re-created with a fresh key after save/reload)
      // would otherwise show a blank trigger.
      applySelection();
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
  }, [multiple]);

  // Repaint the trigger when the selection is driven from React state. Option list changes are picked
  // up by SearchableDropdown's own MutationObserver, which re-reads the same `selected` flags React
  // writes, so late-arriving options need nothing here. The dependency is a string, because `values` is
  // derived per render and its identity would fire this effect on every parent render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(applySelection, [JSON.stringify(values)]);

  return (
    <select
      id={id}
      ref={selectRef}
      multiple={multiple}
      value={multiple ? values : (values[0] ?? '')}
      disabled={disabled || loading}
      onChange={(e) => emit(Array.from(e.target.selectedOptions, (o) => o.value))}
    >
      {/* Empty state: the SearchableDropdown's own `allowEmpty` shows the placeholder as ghost text in
          the trigger and never auto-selects the first option. This empty <option> is kept in the DOM
          only so React can bind value="" (and the native fallback works), but hidden with display:none
          so the dropdown filters it out of the list (it skips display:none options) - it is NOT a
          selectable "Select…" item. */}
      {allowEmpty && <option value="" style={{ display: 'none' }} />}
      {options.map((o) => (
        <option
          key={o.id}
          value={o.id}
          data-icon={o.iconURL || undefined}
          data-icon-bg={o.iconBg || undefined}
          className={optionClass(o)}
        >
          {o.name}
        </option>
      ))}
    </select>
  );
}
