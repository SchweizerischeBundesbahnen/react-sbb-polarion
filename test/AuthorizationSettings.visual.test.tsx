import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import AuthorizationSettings from '../src/components/AuthorizationSettings';
import type { AuthorizationService } from '../src/services/authorizationSettings';
import { settleBeforeCapture } from './helpers';

// Visual-regression states for the shared role-authorization page. Kept separate from the behavior
// tests (Docker-only, since any toMatchScreenshot file diffs on non-Linux font antialiasing).
// References live in test/expected/AuthorizationSettings/ and MUST be generated in Docker
// (npm run test:update:docker).
//
// Each role set is a multi-select SearchableSelect, so what these states pin down is the chip row on a
// trigger, an empty trigger showing its placeholder, and how the two controls sit under their headings.
// The toolbar underneath is the shared ConfigurationButtons row, and the Quick Help block is the one
// per-extension slot.

const ROLES = {
  globalRoles: ['admin', 'project_admin', 'user'],
  projectRoles: ['lead', 'reviewer'],
};

function makeService(over: Partial<AuthorizationService> = {}): AuthorizationService {
  return {
    defaultName: 'Default',
    loadRoles: async () => ROLES,
    loadContent: async () => ({ globalRoles: ['admin'], projectRoles: ['lead'] }),
    saveContent: async () => {},
    loadDefaultContent: async () => ({ globalRoles: [], projectRoles: [] }),
    loadRevisions: async () => [],
    ...over,
  };
}

const origUrl = window.location.pathname + window.location.search;

let container: HTMLDivElement | undefined;

function mount(service: AuthorizationService, quickHelp?: React.ReactNode) {
  window.history.replaceState({}, '', '?embedded=true&scope=project%2Felibrary%2F');
  container = document.createElement('div');
  // Both classes are needed: .sbb-ui declares the --sbb-* tokens, while the generic control CSS scopes
  // part of the Polarion control look to .standard-admin-page / .modal__container / .form-wrapper.
  container.className = 'sbb-ui standard-admin-page';
  container.style.width = '860px';
  container.style.background = '#fff';
  document.body.appendChild(container);
  render(<AuthorizationSettings title="Repair Authorization" service={service} quickHelp={quickHelp} />, {
    container,
  });
}

/** Both controls are upgraded asynchronously, so a capture has to wait for the expected number of
 *  triggers - not just the first one - or it catches the page mid-upgrade. */
const waitForControls = (count: number) =>
  vi.waitFor(() => expect(document.querySelectorAll('.roles-group .sd-trigger-multi')).toHaveLength(count));

const shot = async (name: string) => {
  await settleBeforeCapture();
  return expect(page.elementLocator(container as HTMLElement)).toMatchScreenshot(name);
};

afterEach(() => {
  cleanup();
  container?.remove();
  container = undefined;
  window.history.replaceState({}, '', origUrl);
});

describe.skipIf(!__PIXEL_REFERENCES__)('AuthorizationSettings visual states', () => {
  it('both role groups, some granted, with the toolbar underneath', async () => {
    mount(makeService());
    await waitForControls(2);
    await shot('authorization-granted');
  });

  it('the extension Quick Help block below the toolbar', async () => {
    mount(makeService(), <p>Only members of a listed role may run a repair.</p>);
    await vi.waitFor(() => expect(document.querySelector('.quick-help')).not.toBeNull());
    await waitForControls(2);
    await shot('authorization-quick-help');
  });

  it('a global scope, where there are no project roles to show', async () => {
    mount(makeService({ loadRoles: async () => ({ globalRoles: ROLES.globalRoles, projectRoles: [] }) }));
    await waitForControls(1);
    await shot('authorization-global-only');
  });

  it('nothing granted yet, and no global roles defined at all', async () => {
    mount(
      makeService({
        loadRoles: async () => ({ globalRoles: [], projectRoles: ROLES.projectRoles }),
        loadContent: async () => ({ globalRoles: [], projectRoles: [] }),
      }),
    );
    await vi.waitFor(() => expect(document.body.textContent).toContain('No global roles available.'));
    // Nothing granted, so the one control left paints its placeholder rather than a chip row.
    await waitForControls(1);
    await shot('authorization-no-global-roles');
  });

  it('error banner above the page when the roles cannot be read', async () => {
    mount(makeService({ loadRoles: () => Promise.reject(new Error('offline')) }));
    await vi.waitFor(() => expect(document.querySelector('.alert-error')).not.toBeNull());
    await shot('authorization-load-error');
  });
});
