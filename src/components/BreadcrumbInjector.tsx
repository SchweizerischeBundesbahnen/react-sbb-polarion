import { useEffect } from 'react';

/**
 * File name of the bridge as this library emits it (see vite.bridge.config.ts) and as a consuming
 * extension copies it into the folder Polarion serves its app from.
 */
const BRIDGE_FILE = 'breadcrumb-bridge.js';

/**
 * Set or clear `data-parent`. Removed rather than blanked when absent: the bridge treats a missing
 * attribute as "root topic", and an empty string would read the same but leave a misleading attribute
 * on a script tag that a later re-render may reuse.
 */
function setParent(script: HTMLScriptElement, parent?: string) {
  if (parent) {
    script.dataset.parent = parent;
  } else {
    delete script.dataset.parent;
  }
}

interface BreadcrumbInjectorProps {
  /** Stable per-extension marker (also used as the injected script's DOM id prefix), e.g. "my-extension". */
  marker: string;
  /** Breadcrumb label shown in the shell app header, e.g. "My Extension". */
  title: string;
  /** Absolute URL of the breadcrumb icon (a Polarion-served svg). */
  icon: string;
  /**
   * Parent topic label. With it the breadcrumb renders "Parent › [icon] {title}", matching how Polarion
   * itself shows a sub-topic; without it, the root form "[icon] {title}". Pass it when the app has more
   * than one topic, so navigating between them reads as a hierarchy rather than a flat rename.
   */
  parent?: string;
  /**
   * Override the bridge script's URL. By default it is resolved next to the running app
   * (`<app base>/breadcrumb-bridge.js`), which is where the copy step in the extension's Vite config
   * puts it. Pass this only when the extension serves it from somewhere else.
   */
  src?: string;
}

/**
 * Fixes the app-header breadcrumb when the app is opened as a project-navigation topic (via an
 * extension's custom navigation extender). Polarion otherwise shows a generic "home" there instead of
 * the extension's own name. This injects BreadcrumbBridge.js into the top shell window, configured for
 * the extension via data-* attributes; the bridge swaps the breadcrumb for "[icon] {title}" (or
 * "{parent} › [icon] {title}") while the app URL is active and never touches Polarion's own
 * Administration pages. Renders nothing.
 *
 * The bridge lives in the shell window on purpose, so it outlives this app's frame. That is why it is
 * loaded by URL rather than bundled: it has to run in a realm this bundle is not part of.
 */
export default function BreadcrumbInjector({ marker, title, icon, parent, src }: Readonly<BreadcrumbInjectorProps>) {
  useEffect(() => {
    try {
      // Target the top shell window (which owns the app-header breadcrumb), not the immediate parent:
      // a navigation-extender topic can be nested more than one frame deep.
      const shellWindow = window.top;
      const shellDocument = shellWindow?.document;
      if (!shellDocument?.head) return;

      // Already loaded (by this mount, an earlier one, or another app in the same shell): re-install
      // instead of re-injecting. install() is idempotent per marker and re-labels a live breadcrumb,
      // which is what makes a changed title or icon take effect.
      const bridge = shellWindow?.SbbBreadcrumbBridge;
      if (bridge) {
        bridge.install({ marker, title, icon, parent });
        return;
      }

      const id = `${marker}-breadcrumb-bridge`;
      const pending = shellDocument.getElementById(id) as HTMLScriptElement | null;
      if (pending) {
        // The script is still loading. It reads its config from these attributes when it finally runs,
        // so updating them here is what a title/icon change needs; a second script must not be added.
        pending.dataset.title = title;
        pending.dataset.icon = icon;
        setParent(pending, parent);
        return;
      }

      const scriptElement = shellDocument.createElement('script');
      scriptElement.id = id;
      scriptElement.type = 'text/javascript';
      // Resolved against THIS app's URL (the frame the component renders in), not the shell's: the
      // bridge is served from the extension's own app folder, and the shell sits at a different path.
      scriptElement.src = src ?? new URL(BRIDGE_FILE, window.location.href).href;
      scriptElement.dataset.marker = marker;
      scriptElement.dataset.title = title;
      scriptElement.dataset.icon = icon;
      setParent(scriptElement, parent);
      shellDocument.head.appendChild(scriptElement);
    } catch {
      // Cross-origin parent or access denied - skip breadcrumb injection.
    }
  }, [marker, title, icon, parent, src]);

  return null;
}
