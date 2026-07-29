import { useEffect } from 'react';
import { getGenericModulesBase } from '../config/genericModules';

interface BreadcrumbInjectorProps {
  /** Stable per-extension marker (also used as the injected script's DOM id prefix), e.g. "my-extension". */
  marker: string;
  /** Breadcrumb label shown in the shell app header, e.g. "My Extension". */
  title: string;
  /** Absolute URL of the breadcrumb icon (a Polarion-served svg). */
  icon: string;
}

/**
 * Fixes the app-header breadcrumb when the app is opened as a project-navigation topic (via an
 * extension's custom navigation extender). Polarion otherwise shows a generic "home" there instead of
 * the extension's own name. This injects the shared generic BreadcrumbBridge (served by
 * GenericUiServlet, resolved from the configured generic-modules base) into the top shell window,
 * configured for the extension via data-* attributes; the bridge swaps the breadcrumb for
 * "[icon] {title}" while the app URL is active and never touches Polarion's own Administration pages.
 * Renders nothing.
 */
export default function BreadcrumbInjector({ marker, title, icon }: Readonly<BreadcrumbInjectorProps>) {
  useEffect(() => {
    try {
      // Target the top shell window (which owns the app-header breadcrumb), not the immediate parent:
      // a navigation-extender topic can be nested more than one frame deep.
      const shellDocument = window.top?.document;
      if (!shellDocument?.head) return;

      const id = `${marker}-breadcrumb-bridge`;
      if (shellDocument.getElementById(id)) return;

      const scriptElement = shellDocument.createElement('script');
      scriptElement.id = id;
      scriptElement.type = 'text/javascript';
      scriptElement.src = getGenericModulesBase() + 'BreadcrumbBridge.js';
      scriptElement.dataset.marker = marker;
      scriptElement.dataset.title = title;
      scriptElement.dataset.icon = icon;
      shellDocument.head.appendChild(scriptElement);
    } catch {
      // Cross-origin parent or access denied - skip breadcrumb injection.
    }
  }, [marker, title, icon]);

  return null;
}
