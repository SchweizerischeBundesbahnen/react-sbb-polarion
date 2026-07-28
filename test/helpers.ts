// Shared DOM-interaction helpers for the behavior tests. These drive real browser events (we run in
// Chromium via Vitest browser mode), so tests assert observable behavior rather than private internals.
import { userEvent } from 'vitest/browser';

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

/**
 * Park the pointer in the bottom-right corner, away from anything a visual test renders.
 *
 * Playwright leaves the mouse wherever the previous action put it, and that position survives across
 * tests and across test files. A component that happens to be laid out under that spot is then
 * screenshotted in its `:hover` paint - silently, because the capture still succeeds. That is how the
 * PageLayout/UserGuide references came to carry the `.page-nav a:hover` underline: nothing in those
 * tests touches the mouse, they just inherited a pointer sitting on the "Overview" link, and the
 * references flipped between runs depending on what ran before them.
 *
 * Call it after mounting and before capturing a resting state. A test that is deliberately about
 * `:hover` hovers its target afterwards.
 */
export async function parkPointer(): Promise<void> {
  const spot = document.createElement('div');
  spot.style.cssText = 'position:fixed;right:0;bottom:0;width:4px;height:4px;z-index:2147483647;';
  document.body.appendChild(spot);
  try {
    await userEvent.hover(spot);
  } finally {
    spot.remove();
  }
}
