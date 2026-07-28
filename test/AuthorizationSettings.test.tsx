import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import AuthorizationSettings from '../src/components/AuthorizationSettings';
import Toaster from '../src/components/Toaster';
import type { AuthorizationContent, AuthorizationService } from '../src/services/authorizationSettings';

// The role-checkbox administration page. The extensions that had this page each wrote it out; this is
// the shared one, driven through an injected service so no REST shape is assumed here.

const ROLES = { globalRoles: ['admin', 'user'], projectRoles: ['project_admin'] };
const STORED: AuthorizationContent = { globalRoles: ['admin'], projectRoles: [] };

const origUrl = window.location.pathname + window.location.search;
const setScope = (scope: string) => window.history.replaceState({}, '', `?scope=${encodeURIComponent(scope)}`);

function makeService(overrides: Partial<AuthorizationService> = {}): AuthorizationService {
  return {
    defaultName: 'Default',
    loadRoles: () => Promise.resolve(ROLES),
    loadContent: () => Promise.resolve({ ...STORED }),
    saveContent: () => Promise.resolve(),
    loadDefaultContent: () => Promise.resolve({ globalRoles: [], projectRoles: [] }),
    loadRevisions: () => Promise.resolve([]),
    loadVersion: () => Promise.resolve({ bundleBuildTimestamp: '2026-01-01 00:00' }),
    ...overrides,
  };
}

const roleCheckbox = (role: string): HTMLInputElement => {
  const label = Array.from(document.querySelectorAll('.roles-list label')).find((l) => l.textContent?.trim() === role);
  const cb = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!cb) throw new Error(`role checkbox "${role}" not found`);
  return cb;
};

const button = (label: string): HTMLButtonElement => {
  const b = Array.from(document.querySelectorAll<HTMLButtonElement>('.sbb-btn')).find(
    (x) => (x.textContent ?? '').trim() === label,
  );
  if (!b) throw new Error(`button "${label}" not found`);
  return b;
};

async function answerDialog(label: 'OK' | 'Cancel') {
  await vi.waitFor(() => expect(document.querySelector('.rsp-modal')).not.toBeNull());
  const target = Array.from(document.querySelectorAll<HTMLButtonElement>('.rsp-modal-footer .sbb-btn')).find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (!target) throw new Error(`dialog button "${label}" not found`);
  target.click();
}

async function mount(service = makeService(), quickHelp?: React.ReactNode) {
  render(
    <>
      <Toaster />
      <AuthorizationSettings title="Repair Authorization" service={service} quickHelp={quickHelp} />
    </>,
  );
  await vi.waitFor(() => expect(document.querySelector('.roles-list')).not.toBeNull());
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', origUrl);
});

describe('AuthorizationSettings', () => {
  it('lists both role kinds and ticks what the setting granted', async () => {
    setScope('project/elibrary/');
    await mount();

    expect(document.querySelector('h1')!.textContent).toBe('Repair Authorization');
    expect(roleCheckbox('admin').checked).toBe(true);
    expect(roleCheckbox('user').checked).toBe(false);
    expect(roleCheckbox('project_admin').checked).toBe(false);
  });

  it('offers no project section when the scope has no project roles', async () => {
    await mount(makeService({ loadRoles: () => Promise.resolve({ globalRoles: ['admin'], projectRoles: [] }) }));

    expect(document.body.textContent).toContain('Global Roles');
    expect(document.body.textContent).not.toContain('Project Roles');
  });

  it('says so when there are no global roles at all', async () => {
    await mount(
      makeService({
        loadRoles: () => Promise.resolve({ globalRoles: [], projectRoles: ['project_admin'] }),
      }),
    );

    expect(document.body.textContent).toContain('No global roles available.');
  });

  it('saves the ticked roles, split into global and project', async () => {
    let saved: AuthorizationContent | undefined;
    setScope('project/elibrary/');
    await mount(
      makeService({
        saveContent: (_scope, content) => {
          saved = content;
          return Promise.resolve();
        },
      }),
    );

    roleCheckbox('user').click();
    roleCheckbox('project_admin').click();
    button('Save').click();

    await vi.waitFor(() => expect(saved).toBeDefined());
    expect(saved!.globalRoles.sort()).toEqual(['admin', 'user']);
    expect(saved!.projectRoles).toEqual(['project_admin']);
    await vi.waitFor(() => expect(document.body.textContent).toContain('successfully saved'));
  });

  it('drops a role that no longer exists rather than storing it back', async () => {
    let saved: AuthorizationContent | undefined;
    await mount(
      makeService({
        // The setting still grants a role the scope no longer offers.
        loadContent: () => Promise.resolve({ globalRoles: ['admin', 'retired_role'], projectRoles: [] }),
        saveContent: (_scope, content) => {
          saved = content;
          return Promise.resolve();
        },
      }),
    );

    button('Save').click();

    await vi.waitFor(() => expect(saved).toBeDefined());
    expect(saved!.globalRoles).toEqual(['admin']);
  });

  it('reports a failed save as a toast, carrying the message', async () => {
    await mount(makeService({ saveContent: () => Promise.reject(new Error('read-only setting')) }));

    button('Save').click();

    await vi.waitFor(() => expect(document.body.textContent).toContain('read-only setting'));
  });

  it('restores the stored selection when the cancel is confirmed', async () => {
    await mount();
    roleCheckbox('user').click();
    expect(roleCheckbox('user').checked).toBe(true);

    button('Cancel').click();
    await answerDialog('OK');

    await vi.waitFor(() => expect(roleCheckbox('user').checked).toBe(false));
  });

  it('keeps the edit when the cancel is dismissed', async () => {
    await mount();
    roleCheckbox('user').click();

    button('Cancel').click();
    await answerDialog('Cancel');

    expect(roleCheckbox('user').checked).toBe(true);
  });

  it('reverts to the default values when confirmed', async () => {
    await mount();
    expect(roleCheckbox('admin').checked).toBe(true);

    button('Default').click();
    await answerDialog('OK');

    await vi.waitFor(() => expect(roleCheckbox('admin').checked).toBe(false));
    expect(document.body.textContent).toContain('Reverted to the default values');
  });

  it('keeps the selection when the revert is dismissed', async () => {
    await mount();

    button('Default').click();
    await answerDialog('Cancel');

    expect(roleCheckbox('admin').checked).toBe(true);
  });

  it('shows the revisions and applies the one picked', async () => {
    await mount(
      makeService({
        loadRevisions: () => Promise.resolve([{ name: '4321', date: '2026-01-01', author: 'jdoe' }]),
        loadContent: (_scope, revision) =>
          Promise.resolve(revision ? { globalRoles: ['user'], projectRoles: [] } : { ...STORED }),
      }),
    );

    button('Revisions').click();
    await vi.waitFor(() => expect(document.querySelector('.revision-number')).not.toBeNull());
    document.querySelector<HTMLButtonElement>('.revert-to-revision-button')!.click();

    await vi.waitFor(() => expect(roleCheckbox('user').checked).toBe(true));
    expect(roleCheckbox('admin').checked).toBe(false);
  });

  it('warns when the setting was written by an older bundle, and stops after a save', async () => {
    await mount(
      makeService({
        loadContent: () => Promise.resolve({ ...STORED, bundleTimestamp: '2020-01-01 00:00' }),
      }),
    );

    expect(document.querySelector('.alert-warning')).not.toBeNull();

    button('Save').click();

    await vi.waitFor(() => expect(document.querySelector('.alert-warning')).toBeNull());
  });

  it('does not warn when the setting matches the installed bundle', async () => {
    await mount(
      makeService({
        loadContent: () => Promise.resolve({ ...STORED, bundleTimestamp: '2026-01-01 00:00' }),
      }),
    );

    expect(document.querySelector('.alert-warning')).toBeNull();
  });

  it('shows no warning at all when the service cannot report a version', async () => {
    await mount(
      makeService({
        loadVersion: undefined,
        loadContent: () => Promise.resolve({ ...STORED, bundleTimestamp: '2020-01-01 00:00' }),
      }),
    );

    // Without a version to compare against the page would otherwise cry wolf on every load.
    expect(document.querySelector('.alert-warning')).toBeNull();
  });

  it('reports a page it could not load', async () => {
    render(
      <AuthorizationSettings
        title="Repair Authorization"
        service={makeService({ loadRoles: () => Promise.reject(new Error('boom')) })}
      />,
    );

    await vi.waitFor(() => expect(document.querySelector('.alert-error')).not.toBeNull());
  });

  it('renders the extension help text', async () => {
    await mount(makeService(), <p>Only admins may repair.</p>);

    expect(document.body.textContent).toContain('Only admins may repair.');
  });

  it('leaves the help section out when the extension supplies none', async () => {
    await mount();

    expect(document.querySelector('.quick-help')).toBeNull();
  });
});
