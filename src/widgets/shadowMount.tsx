import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Brings the page's own stylesheets into a shadow root.
 *
 * A widget on a report page renders Polarion's table and button markup and has to look like the rest of the
 * page, but a shadow root sees none of the page's rules. Cloning the links rather than copying the rules
 * keeps every relative url() in those stylesheets resolving against the stylesheet, and the browser serves
 * the second request from its cache.
 */
export function adoptPageStyles(root: ShadowRoot): void {
  document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => {
    const clone = document.createElement('link');
    clone.rel = 'stylesheet';
    clone.href = link.href;
    root.appendChild(clone);
  });
}

function addStyle(root: ShadowRoot, css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);
}

export interface ShadowMountOptions {
  /** Stylesheets for the root, in this order and after the page's own, so that they win where both apply. */
  styles: string[];
  /**
   * The class of the container the app renders into. Include `sbb-ui`, the scope the --sbb-* tokens are
   * declared on: they would also inherit from the host, but declaring them inside keeps the widget
   * self-contained, which is what a dev harness and the tests mount it as.
   */
  className: string;
}

/**
 * Gives a host element a shadow root with the page's stylesheets and the given ones, and renders an element
 * into it. A report page may carry several widgets, and the page around them is Polarion's, so each one gets
 * a root of its own. A host that has a shadow root already is left as it is: the module that mounts it may be
 * imported more than once.
 *
 * @returns the new shadow root, or null where the host had one already
 */
export function mountInShadowRoot(
  host: HTMLElement,
  options: ShadowMountOptions,
  element: ReactNode,
): ShadowRoot | null {
  if (host.shadowRoot) {
    return null;
  }
  const root = host.attachShadow({ mode: 'open' });
  adoptPageStyles(root);
  options.styles.forEach((css) => addStyle(root, css));

  const container = document.createElement('div');
  container.className = options.className;
  root.appendChild(container);

  createRoot(container).render(<StrictMode>{element}</StrictMode>);
  return root;
}
