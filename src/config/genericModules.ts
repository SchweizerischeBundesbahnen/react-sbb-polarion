// Base URL of the generic UI toolkit's ES modules (SearchableDropdown etc.), served at runtime by
// Polarion's GenericUiServlet under each extension's own webapp context. The context name differs per
// extension (e.g. /polarion/<extension>-app/ui/generic/js/modules/), and in `vite dev` the app is
// served at `/` with no `/ui/` segment to derive from, so the consuming app configures the base once
// at startup (in each entry point) via configureGenericModules(). If it is never configured and the
// path cannot be derived, the loader URL will 404 and the wrappers keep their native fallback.

let configuredBase: string | null = null;

/**
 * Set the runtime base URL for the generic ES modules. Call once per entry point (main.tsx, and any
 * separate form-extension bundle entry), before any SearchableSelect mounts. Pass the absolute path
 * Polarion serves (and the dev proxy forwards), e.g.
 * `/polarion/<extension>-app/ui/generic/js/modules/`. A trailing slash is optional.
 */
export function configureGenericModules(base: string): void {
  configuredBase = base.endsWith('/') ? base : `${base}/`;
}

/**
 * Resolve the generic-modules base: the configured value if set, otherwise derived from the current
 * page path (works in Polarion, where the path contains `/ui/`).
 */
export function getGenericModulesBase(): string {
  if (configuredBase) return configuredBase;
  const { pathname } = window.location;
  if (pathname.includes('/ui/')) {
    return pathname.replace(/\/ui\/.*$/, '/ui/generic/js/modules/');
  }
  return '/ui/generic/js/modules/';
}
