// Shared DOM-interaction helpers for the behavior tests. These drive real browser events (we run in
// Chromium via Vitest browser mode), so tests assert observable behavior rather than private internals.

// `composed: true` mirrors real UI events and lets them cross a shadow-root boundary to reach the
// document-level outside-click listener (needed for the shadow-DOM tests; harmless in light DOM).

/** Fire a bubbling, cancelable mousedown at a node (the dropdown opens/closes/selects on mousedown). */
export function mousedown(node: Element): void {
  node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, composed: true }));
}

/** Fire a bubbling, cancelable keydown with the given key at a node. */
export function keydown(node: Element, key: string): void {
  node.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true }));
}

/** Set an input's value and fire the `input` event the dropdown's search box listens for. */
export function typeInto(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Let queued MutationObserver callbacks (option/attribute resync) run before asserting. */
export const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
