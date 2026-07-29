// Minimal type declarations for the vendored `searchableSelect.js` factory (copied verbatim from the
// generic framework's js/modules/). The runtime is plain JS bundled by Vite; these types are just
// enough for the React wrappers that consume it.

export interface SearchableDropdownInstance {
  /** Set the current selection (mirrors it onto the wrapped control and its visible trigger). */
  selectValue(value: string): void;
  /**
   * Repaint the trigger from the wrapped control's current selection, without firing a change event.
   * Covers both modes: the single-select value and the multi-select chips.
   */
  syncFromElement(): void;
  /** Tear down the dropdown and its body-level portal. */
  destroy(): void;
  [key: string]: unknown;
}

export function createSearchableSelect(
  selectElement: HTMLSelectElement,
  options?: Record<string, unknown>,
): SearchableDropdownInstance;

export function createEditableSelect(
  inputElement: HTMLInputElement,
  options?: Record<string, unknown>,
): SearchableDropdownInstance;

export function initSearchableDropdowns(
  ctx: unknown,
  singleIds: string[],
  multiSelectId?: string | null,
  options?: Record<string, unknown>,
): void;
