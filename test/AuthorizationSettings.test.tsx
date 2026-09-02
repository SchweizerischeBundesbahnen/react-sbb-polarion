import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import AuthorizationSettings from '../src/components/AuthorizationSettings';
import Toaster from '../src/components/Toaster';
import type { AuthorizationContent, AuthorizationService } from '../src/services/authorizationSettings';
import { mousedown } from './helpers';

// The role-authorization administration page. The extensions that had this page each wrote it out; this
// is the shared one, driven through an injected service so no REST shape is assumed here. Each role set
// is a multi-select SearchableSelect: granted roles are chips on the trigger, the rest are checkbox
// options in the popup.

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
    ...overrides,
  };
}

/** The upgraded control of one role set. The dropdown inserts itself right after the <select> it wraps,
 *  which the page ids, so this addresses the two controls without depending on their page order. */
const control = (kind: 'global' | 'project'): HTMLElement => {
  const wrapped = document.querySelector(`#${kind}-roles`);
  const container = wrapped?.nextElementSibling;
  if (!(container instanceof HTMLElement) || !container.classList.contains('searchable-dropdown')) {
    throw new Error(`no ${kind} roles control`);
  }
  return container;
};

const trigger = (kind: 'global' | 'project'): HTMLElement =>
  control(kind).querySelector<HTMLElement>('.sd-trigger-multi')!;

/** The popup of one control. Every dropdown keeps its own portal in the body, so the options have to be
 *  read through the trigger's aria-controls rather than from the first .sd-portal in the document. */
const options = (kind: 'global' | 'project'): HTMLElement[] => {
  const listbox = document.getElementById(trigger(kind).getAttribute('aria-controls')!)!;
  return Array.from(listbox.querySelectorAll<HTMLElement>('.option'));
};

/** The roles a control offers. The popup renders its options only while open, so this opens it, reads
 *  them and closes it again. */
const listedRoles = (kind: 'global' | 'project'): string[] => {
  mousedown(trigger(kind));
  const labels = options(kind).map((option) => (option.textContent ?? '').trim());
  mousedown(trigger(kind));
  return labels;
};

/** The granted roles of one set, as the chips painted on its trigger. */
const granted = (kind: 'global' | 'project'): string[] =>
  Array.from(control(kind).querySelectorAll('.sd-chip-label')).map((chip) => (chip.textContent ?? '').trim());

/** Opens the popup, ticks (or unticks) one role, closes it again, and waits for the chips to follow -
 *  which is also what proves React took the change, so a Save right after reads the new selection. */
async function toggleRole(kind: 'global' | 'project', role: string) {
  const wasGranted = granted(kind).includes(role);
  mousedown(trigger(kind));
  const option = options(kind).find((o) => (o.textContent ?? '').trim() === role);
  if (!option) throw new Error(`role option "${role}" not found`);
  mousedown(option);
  mousedown(trigger(kind));
  await vi.waitFor(() => expect(granted(kind).includes(role)).toBe(!wasGranted));
}

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
  await vi.waitFor(() => expect(document.querySelector('.roles-group .sd-trigger-multi')).not.toBeNull());
}

afterEach(() => {
  cleanup();
  document.querySelectorAll('.sd-portal').forEach((el) => el.remove());
  window.history.replaceState({}, '', origUrl);
});

describe('AuthorizationSettings', () => {
  it('offers both role kinds and shows what the setting granted', async () => {
    setScope('project/elibrary/');
    await mount();

    expect(document.querySelector('h1')!.textContent).toBe('Repair Authorization');
    expect(listedRoles('global')).toEqual(['admin', 'user']);
    expect(listedRoles('project')).toEqual(['project_admin']);
    expect(granted('global')).toEqual(['admin']);
    expect(granted('project')).toEqual([]);
  });

  it('names each combobox after its role group, so the two are told apart', async () => {
    setScope('project/elibrary/');
    await mount();

    const names = Array.from(document.querySelectorAll('.roles-group .sd-trigger-multi'), (el) =>
      el.getAttribute('aria-label'),
    );
    expect(names).toEqual(['Global Roles', 'Project Roles']);
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
    expect(document.querySelector('#global-roles')).toBeNull();
  });

  it('saves the granted roles, split into global and project', async () => {
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

    await toggleRole('global', 'user');
    await toggleRole('project', 'project_admin');
    button('Save').click();

    await vi.waitFor(() => expect(saved).toBeDefined());
    expect(saved!.globalRoles).toEqual(['admin', 'user']);
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

    // It has no option either, so it cannot even be seen - only the roles the scope offers get a chip.
    expect(granted('global')).toEqual(['admin']);

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
    await toggleRole('global', 'user');

    button('Cancel').click();
    await answerDialog('OK');

    await vi.waitFor(() => expect(granted('global')).toEqual(['admin']));
  });

  it('keeps the edit when the cancel is dismissed', async () => {
    await mount();
    await toggleRole('global', 'user');

    button('Cancel').click();
    await answerDialog('Cancel');

    expect(granted('global')).toEqual(['admin', 'user']);
  });

  it('reverts to the default values when confirmed', async () => {
    await mount();
    expect(granted('global')).toEqual(['admin']);

    button('Default').click();
    await answerDialog('OK');

    await vi.waitFor(() => expect(granted('global')).toEqual([]));
    expect(document.body.textContent).toContain('Reverted to the default values');
  });

  it('keeps the selection when the revert is dismissed', async () => {
    await mount();

    button('Default').click();
    await answerDialog('Cancel');

    expect(granted('global')).toEqual(['admin']);
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

    await vi.waitFor(() => expect(granted('global')).toEqual(['user']));
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

  it('revokes a granted role', async () => {
    await mount();
    expect(granted('global')).toEqual(['admin']);

    await toggleRole('global', 'admin');

    expect(granted('global')).toEqual([]);
  });

  // A setting written before one of the two role kinds existed comes back without that array at all;
  // the page has to treat it as "nothing granted" instead of failing on the missing property.
  it('treats a stored setting with no role arrays as nothing granted', async () => {
    await mount(makeService({ loadContent: () => Promise.resolve({} as AuthorizationContent) }));

    expect(granted('global')).toEqual([]);
    expect(granted('project')).toEqual([]);
  });

  it('falls back to a generic message when a failed save carries none', async () => {
    await mount(makeService({ saveContent: () => Promise.reject(new Error('')) }));

    button('Save').click();

    await vi.waitFor(() => expect(document.body.textContent).toContain('Error occurred during saving the data'));
  });

  // The mount effect guards both settle paths with `cancelled`. Navigating away from the page before
  // the roles arrive must not push them (or the load banner) into an unmounted tree.
  it('ignores roles that resolve after unmount', async () => {
    let settle!: (roles: typeof ROLES) => void;
    render(
      <AuthorizationSettings
        title="Repair Authorization"
        service={makeService({ loadRoles: () => new Promise((resolve) => (settle = resolve)) })}
      />,
    );
    await vi.waitFor(() => expect(document.body.textContent).toContain('Loading...'));

    cleanup();
    settle(ROLES);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.roles-group')).toBeNull();
  });

  it('ignores a load failure that rejects after unmount', async () => {
    let fail!: (reason: Error) => void;
    render(
      <AuthorizationSettings
        title="Repair Authorization"
        service={makeService({ loadRoles: () => new Promise((_resolve, reject) => (fail = reject)) })}
      />,
    );
    await vi.waitFor(() => expect(document.body.textContent).toContain('Loading...'));

    cleanup();
    fail(new Error('boom'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.alert-error')).toBeNull();
  });

  // Every toolbar action that re-reads the setting can fail on its own, long after the page loaded
  // fine. Each one has to surface the load banner rather than silently leaving the stale selection on
  // screen, which would look like the action succeeded.
  it('reports a failed re-read of the stored roles when cancelling', async () => {
    let calls = 0;
    await mount(
      makeService({
        loadContent: () => (++calls === 1 ? Promise.resolve({ ...STORED }) : Promise.reject(new Error('gone'))),
      }),
    );
    await toggleRole('global', 'user');

    button('Cancel').click();
    await answerDialog('OK');

    await vi.waitFor(() => expect(document.querySelector('.alert-error')).not.toBeNull());
    expect(document.querySelector('.alert-error')!.textContent).toContain('Error occurred loading the data');
  });

  it('reports a failed read of the default values', async () => {
    await mount(makeService({ loadDefaultContent: () => Promise.reject(new Error('nope')) }));

    button('Default').click();
    await answerDialog('OK');

    await vi.waitFor(() => expect(document.querySelector('.alert-error')).not.toBeNull());
    expect(document.body.textContent).not.toContain('Reverted to the default values');
  });

  it('reports a revision whose content cannot be read', async () => {
    await mount(
      makeService({
        loadRevisions: () => Promise.resolve([{ name: '4321', date: '2026-01-01', author: 'jdoe' }]),
        loadContent: (_scope, revision) =>
          revision ? Promise.reject(new Error('gone')) : Promise.resolve({ ...STORED }),
      }),
    );

    button('Revisions').click();
    await vi.waitFor(() => expect(document.querySelector('.revision-number')).not.toBeNull());
    document.querySelector<HTMLButtonElement>('.revert-to-revision-button')!.click();

    await vi.waitFor(() => expect(document.querySelector('.alert-error')).not.toBeNull());
    expect(granted('global')).toEqual(['admin']);
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
