// Minimal type declarations for the vendored `SearchableDropdown.js` class (see searchableSelect.d.ts
// for the factory functions). Hand-written types for the copied-in JS — not vendored from generic.
// The index signature keeps internal properties/methods (items, _open, container, portal, ...)
// accessible from behavior tests without enumerating them all.

export interface SearchableDropdownOptions {
  // Usually a <select>, but the class also wraps non-<select> elements (editable / free-text mode) and
  // accepts a CSS selector string.
  element?: HTMLElement | string;
  selectContainer?: HTMLElement | string;
  multiselect?: boolean;
  allowEmpty?: boolean;
  clearable?: boolean;
  rememberSelection?: boolean;
  placeholder?: string;
  [key: string]: unknown;
}

export default class SearchableDropdown {
  constructor(options: SearchableDropdownOptions);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
