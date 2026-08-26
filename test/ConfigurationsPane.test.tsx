import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import {
  ConfigurationsPane,
  type ConfigurationsPaneHandle,
  type ConfigurationsService,
} from '../src/components/ConfigurationsPane';
import { mousedown } from './helpers';

// Behavior tests for the shared ConfigurationsPane. It is decoupled from any extension: the REST ops
// come in through the `service` prop and content type T. We inject a mock service and drive the
// selector / create / rename / delete flows, asserting the injected callbacks + observable DOM. The
// initial selection is steered via the remember-cookie so we don't have to operate the async dropdown.

type Content = { name: string };

const NAMES = [
  { name: 'Default', scope: '' },
  { name: 'foo', scope: '' },
];

function makeService(over: Partial<ConfigurationsService<Content>> = {}): ConfigurationsService<Content> {
  return {
    loadConfigurationNames: vi.fn(async () => NAMES),
    loadContent: vi.fn(async (name: string) => ({ name })),
    createConfiguration: vi.fn(async () => {}),
    renameConfiguration: vi.fn(async () => {}),
    deleteConfiguration: vi.fn(async () => {}),
    ...over,
  };
}

const pane = () => document.querySelector('.configurations-pane');
const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.configurations-pane button'));
const btn = (text: string): HTMLButtonElement => {
  const b = buttons().find((x) => (x.textContent ?? '').trim() === text);
  if (!b)
    throw new Error(
      `button "${text}" not found; have: ${buttons()
        .map((x) => x.textContent?.trim())
        .join(' | ')}`,
    );
  return b;
};
const nameInput = () => document.querySelector('.config-edit-row input[type="text"]') as HTMLInputElement | null;
const alertError = () => document.querySelector('.alert-error');
const note = () => document.querySelector('.config-note');

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

interface Opts {
  scope?: string;
  service?: ConfigurationsService<Content>;
  label?: string;
  onEditingNameChange?: () => void;
  ref?: React.Ref<ConfigurationsPaneHandle>;
}

function renderPane(opts: Opts = {}) {
  const service = opts.service ?? makeService();
  const onContentLoaded = vi.fn();
  const onSelectedChange = vi.fn();
  const onEditingNameChange = opts.onEditingNameChange ?? vi.fn();
  render(
    <ConfigurationsPane<Content>
      scope={opts.scope ?? ''}
      service={service}
      cookieKey="ck-test"
      label={opts.label}
      onContentLoaded={onContentLoaded}
      onSelectedChange={onSelectedChange}
      onEditingNameChange={onEditingNameChange}
      ref={opts.ref}
    />,
  );
  return { service, onContentLoaded, onSelectedChange, onEditingNameChange };
}

async function mount(opts: Opts = {}) {
  const r = renderPane(opts);
  await vi.waitFor(() => expect(pane()).not.toBeNull());
  return r;
}

afterEach(() => {
  cleanup();
  clearCookies();
  vi.restoreAllMocks();
});

describe('ConfigurationsPane', () => {
  it('loads the names, auto-selects the first, and loads its content', async () => {
    const { service, onContentLoaded, onSelectedChange } = await mount();
    await vi.waitFor(() => expect(onContentLoaded).toHaveBeenCalledWith({ name: 'Default' }));
    expect(service.loadConfigurationNames).toHaveBeenCalledWith('');
    expect(service.loadContent).toHaveBeenCalledWith('Default', '');
    expect(onSelectedChange).toHaveBeenCalledWith('Default');
    expect(document.querySelector('.config-row label')?.textContent).toBe('Selected configuration:');
  });

  it('reports null selection and loads no content when the list is empty', async () => {
    const service = makeService({ loadConfigurationNames: vi.fn(async () => []) });
    const { onSelectedChange } = await mount({ service });
    await vi.waitFor(() => expect(onSelectedChange).toHaveBeenCalledWith(null));
    expect(service.loadContent).not.toHaveBeenCalled();
  });

  it('shows the Default note and disables Rename/Delete for the Default config at global scope', async () => {
    await mount();
    await vi.waitFor(() =>
      expect(note()?.textContent).toContain("The Default configuration can't be renamed or deleted."),
    );
    expect(btn('Rename').disabled).toBe(true);
    expect(btn('Delete').disabled).toBe(true);
    expect(btn('Add new').disabled).toBe(false);
  });

  it('honors the remember-cookie to select a specific configuration', async () => {
    document.cookie = 'ck-test=foo; path=/';
    const { service } = await mount();
    await vi.waitFor(() => expect(service.loadContent).toHaveBeenCalledWith('foo', ''));
  });

  it('creates a configuration from the "Add new" editor', async () => {
    const { service, onEditingNameChange } = await mount();
    btn('Add new').click();
    await vi.waitFor(() => expect(nameInput()).not.toBeNull());
    expect(onEditingNameChange).toHaveBeenCalledWith(true);
    await userEvent.fill(nameInput()!, 'brandnew');
    btn('Save').click();
    await vi.waitFor(() => expect(service.createConfiguration).toHaveBeenCalledWith('brandnew', ''));
  });

  it('rejects an invalid configuration name and does not create it', async () => {
    const { service } = await mount();
    btn('Add new').click();
    await vi.waitFor(() => expect(nameInput()).not.toBeNull());
    await userEvent.fill(nameInput()!, 'bad*name');
    btn('Save').click();
    await vi.waitFor(() =>
      expect(alertError()?.textContent).toContain('Only alphanumeric characters, hyphens and spaces are allowed'),
    );
    expect(service.createConfiguration).not.toHaveBeenCalled();
  });

  it('rejects a duplicate configuration name', async () => {
    const { service } = await mount();
    btn('Add new').click();
    await vi.waitFor(() => expect(nameInput()).not.toBeNull());
    await userEvent.fill(nameInput()!, 'foo'); // already exists at this scope
    btn('Save').click();
    await vi.waitFor(() =>
      expect(alertError()?.textContent).toContain('A configuration with this name already exists'),
    );
    expect(service.createConfiguration).not.toHaveBeenCalled();
  });

  it('renames the selected configuration (editor prefilled with the current name)', async () => {
    document.cookie = 'ck-test=foo; path=/';
    const { service } = await mount();
    await vi.waitFor(() => expect(service.loadContent).toHaveBeenCalledWith('foo', ''));
    btn('Rename').click();
    await vi.waitFor(() => expect(nameInput()?.value).toBe('foo'));
    await userEvent.fill(nameInput()!, 'renamed');
    btn('Update').click();
    await vi.waitFor(() => expect(service.renameConfiguration).toHaveBeenCalledWith('foo', '', 'renamed'));
  });

  /** The confirm dialog is a real element now, so answer it by clicking its footer button. The
   *  confirming button is labelled after the action ("Delete"), not "OK". */
  const answerDialog = async (label: string) => {
    await vi.waitFor(() => expect(document.querySelector('.rsp-modal')).not.toBeNull());
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.rsp-modal-footer .sbb-btn')).find(
      (b) => (b.textContent ?? '').trim() === label,
    );
    if (!button) throw new Error(`dialog button not found: ${label}`);
    button.click();
  };

  it('deletes the selected configuration after confirmation', async () => {
    document.cookie = 'ck-test=foo; path=/';
    const { service } = await mount();
    await vi.waitFor(() => expect(service.loadContent).toHaveBeenCalledWith('foo', ''));
    btn('Delete').click();
    await answerDialog('Delete');
    await vi.waitFor(() => expect(service.deleteConfiguration).toHaveBeenCalledWith('foo', ''));
  });

  it('does not delete when the confirmation is cancelled', async () => {
    document.cookie = 'ck-test=foo; path=/';
    const { service } = await mount();
    await vi.waitFor(() => expect(service.loadContent).toHaveBeenCalledWith('foo', ''));
    btn('Delete').click();
    await answerDialog('Cancel');
    // Give the (cancelled) handler a tick, then assert nothing was deleted.
    await new Promise((r) => setTimeout(r, 20));
    expect(service.deleteConfiguration).not.toHaveBeenCalled();
    expect(document.querySelector('.rsp-modal')).toBeNull();
  });

  it('shows the inherited-from-global note and disables editing for a parent-scope config', async () => {
    document.cookie = 'ck-test=global-cfg; path=/';
    const service = makeService({
      loadConfigurationNames: vi.fn(async () => [{ name: 'global-cfg', scope: '' }]),
    });
    await mount({ scope: 'project/elibrary/', service });
    await vi.waitFor(() => expect(note()?.textContent).toContain('inherited from the global scope'));
    expect(btn('Rename').disabled).toBe(true);
    expect(btn('Delete').disabled).toBe(true);
  });

  it('lists a config of a broader scope by name, marked as inherited', async () => {
    document.cookie = 'ck-test=project-cfg; path=/';
    const service = makeService({
      loadConfigurationNames: vi.fn(async () => [
        { name: 'global-cfg', scope: '' },
        { name: 'project-cfg', scope: 'project/elibrary/' },
      ]),
    });
    await mount({ scope: 'project/elibrary/', service });
    await vi.waitFor(() => expect(document.querySelector('.searchable-dropdown .sd-trigger')).not.toBeNull());
    mousedown(document.querySelector('.searchable-dropdown .sd-trigger') as HTMLElement);
    const options = Array.from(document.querySelectorAll<HTMLElement>('.sd-portal .items .option'));
    // The name carries no "(inherited)" suffix: the marker is the `parent` class, which the shared CSS
    // renders as a small italic "global" on the right of the option.
    expect(options.map((o) => (o.textContent ?? '').trim())).toEqual(['global-cfg', 'project-cfg']);
    expect(options[0].classList.contains('parent')).toBe(true);
    expect(options[1].classList.contains('parent')).toBe(false);
    expect(getComputedStyle(options[0], '::after').content).toBe('"global"');
  });

  // The real "save it on this level first" flow: a global-scope configuration is saved onto the project
  // scope, the consuming page calls reloadNames, and the same name comes back owned by this scope. The
  // marker, the note and the buttons all have to follow without a page reload.
  it('drops the inherited marker after the configuration is saved on this scope', async () => {
    document.cookie = 'ck-test=Default; path=/';
    const scope = 'project/elibrary/';
    let owned = false;
    const service = makeService({
      loadConfigurationNames: vi.fn(async () => [{ name: 'Default', scope: owned ? scope : '' }]),
    });
    const ref = createRef<ConfigurationsPaneHandle>();
    await mount({ scope, service, ref });
    await vi.waitFor(() => expect(note()?.textContent).toContain('inherited from the global scope'));
    mousedown(document.querySelector('.searchable-dropdown .sd-trigger') as HTMLElement);
    expect(document.querySelector('.sd-portal .items .option')?.classList.contains('parent')).toBe(true);

    owned = true;
    await ref.current!.reloadNames();

    await vi.waitFor(() =>
      expect(document.querySelector('.sd-portal .items .option')?.classList.contains('parent')).toBe(false),
    );
    expect(document.querySelector('.sd-portal .items .option')?.textContent).toBe('Default');
    expect(note()).toBeNull();
    expect(btn('Rename').disabled).toBe(false);
  });

  it('shows a load-error banner when loading the names fails', async () => {
    const service = makeService({
      loadConfigurationNames: vi.fn(async () => {
        throw new Error('nope');
      }),
    });
    await mount({ service });
    await vi.waitFor(() =>
      expect(alertError()?.textContent).toContain('Error occurred loading the list of configurations.'),
    );
  });

  it('shows a delete-error banner when deletion fails', async () => {
    document.cookie = 'ck-test=foo; path=/';
    const service = makeService({
      deleteConfiguration: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    await mount({ service });
    await vi.waitFor(() => expect(service.loadContent).toHaveBeenCalledWith('foo', ''));
    btn('Delete').click();
    await answerDialog('Delete');
    await vi.waitFor(() =>
      expect(alertError()?.textContent).toContain('Error occurred while deleting the configuration.'),
    );
  });

  it('uses the label prop as the configuration noun', async () => {
    await mount({ label: 'mapping' });
    expect(document.querySelector('.config-row label')?.textContent).toBe('Selected mapping:');
    await vi.waitFor(() => expect(note()?.textContent).toContain("The Default mapping can't be renamed or deleted."));
  });

  it('toggles onEditingNameChange as the editor opens and closes', async () => {
    const onEditingNameChange = vi.fn();
    await mount({ onEditingNameChange });
    btn('Add new').click();
    await vi.waitFor(() => expect(nameInput()).not.toBeNull());
    expect(onEditingNameChange).toHaveBeenLastCalledWith(true);
    btn('Cancel').click();
    await vi.waitFor(() => expect(nameInput()).toBeNull());
    expect(onEditingNameChange).toHaveBeenLastCalledWith(false);
  });

  it('exposes reloadNames through the ref', async () => {
    const ref = createRef<ConfigurationsPaneHandle>();
    const { service } = await mount({ ref });
    await vi.waitFor(() => expect(service.loadConfigurationNames).toHaveBeenCalledTimes(1));
    await ref.current!.reloadNames();
    expect(service.loadConfigurationNames).toHaveBeenCalledTimes(2);
  });

  // The name list can load while the content behind the selected name cannot; that is a separate
  // failure from the list request itself and still has to reach the banner.
  it('shows the load-error banner when the selected content cannot be read', async () => {
    const service = makeService({
      loadContent: vi.fn(async () => {
        throw new Error('content gone');
      }),
    });
    await mount({ service });
    await vi.waitFor(() => expect(alertError()).not.toBeNull());
  });

  // After a create the pane reloads the list and must land on the new entry, overriding the
  // remember-cookie that still points at the previously selected one.
  it('selects the freshly created configuration over the remembered one', async () => {
    document.cookie = 'ck-test=foo; path=/';
    let created = false;
    const service = makeService({
      loadConfigurationNames: vi.fn(async () => (created ? [...NAMES, { name: 'brandnew', scope: '' }] : NAMES)),
      createConfiguration: vi.fn(async () => {
        created = true;
      }),
    });
    await mount({ service });
    await vi.waitFor(() => expect(service.loadContent).toHaveBeenCalledWith('foo', ''));

    btn('Add new').click();
    await vi.waitFor(() => expect(nameInput()).not.toBeNull());
    await userEvent.fill(nameInput()!, 'brandnew');
    btn('Save').click();

    await vi.waitFor(() => expect(service.loadContent).toHaveBeenCalledWith('brandnew', ''));
  });

  it('reports why creating a configuration failed', async () => {
    const service = makeService({
      createConfiguration: vi.fn(async () => {
        throw new Error('disk full');
      }),
    });
    await mount({ service });
    btn('Add new').click();
    await vi.waitFor(() => expect(nameInput()).not.toBeNull());
    await userEvent.fill(nameInput()!, 'brandnew');
    btn('Save').click();

    await vi.waitFor(() => expect(alertError()?.textContent).toContain('disk full'));
  });

  it('falls back to a generic message when a failed create carries none', async () => {
    const service = makeService({
      createConfiguration: vi.fn(async () => {
        throw new Error('');
      }),
    });
    await mount({ service });
    btn('Add new').click();
    await vi.waitFor(() => expect(nameInput()).not.toBeNull());
    await userEvent.fill(nameInput()!, 'brandnew');
    btn('Save').click();

    await vi.waitFor(() =>
      expect(alertError()?.textContent).toContain('Error occurred while saving the configuration'),
    );
  });

  // Renaming validates the same way creating does - the new name must be legal and must not collide
  // with a sibling - and a rejected name must never reach the service.
  it('rejects an invalid new name when renaming', async () => {
    document.cookie = 'ck-test=foo; path=/';
    const { service } = await mount();
    await vi.waitFor(() => expect(service.loadContent).toHaveBeenCalledWith('foo', ''));

    btn('Rename').click();
    await vi.waitFor(() => expect(nameInput()?.value).toBe('foo'));
    await userEvent.fill(nameInput()!, 'bad*name');
    btn('Update').click();

    await vi.waitFor(() =>
      expect(alertError()?.textContent).toContain('Only alphanumeric characters, hyphens and spaces are allowed'),
    );
    expect(service.renameConfiguration).not.toHaveBeenCalled();
  });

  it('reports why renaming failed', async () => {
    document.cookie = 'ck-test=foo; path=/';
    const service = makeService({
      renameConfiguration: vi.fn(async () => {
        throw new Error('locked by another user');
      }),
    });
    await mount({ service });
    await vi.waitFor(() => expect(service.loadContent).toHaveBeenCalledWith('foo', ''));

    btn('Rename').click();
    await vi.waitFor(() => expect(nameInput()?.value).toBe('foo'));
    await userEvent.fill(nameInput()!, 'renamed');
    btn('Update').click();

    await vi.waitFor(() => expect(alertError()?.textContent).toContain('locked by another user'));
  });

  it('falls back to a generic message when a failed rename carries none', async () => {
    document.cookie = 'ck-test=foo; path=/';
    const service = makeService({
      renameConfiguration: vi.fn(async () => {
        throw new Error('');
      }),
    });
    await mount({ service });
    await vi.waitFor(() => expect(service.loadContent).toHaveBeenCalledWith('foo', ''));

    btn('Rename').click();
    await vi.waitFor(() => expect(nameInput()?.value).toBe('foo'));
    await userEvent.fill(nameInput()!, 'renamed');
    btn('Update').click();

    await vi.waitFor(() =>
      expect(alertError()?.textContent).toContain('Error occurred while saving the configuration'),
    );
  });
});
