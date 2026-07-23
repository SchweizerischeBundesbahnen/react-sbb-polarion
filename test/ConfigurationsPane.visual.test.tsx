import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { userEvent } from 'vitest/browser';
import { ConfigurationsPane, type ConfigurationsService } from '../src/components/ConfigurationsPane';

// Visual-regression states for the shared ConfigurationsPane. Kept separate from the behavior tests
// (Docker-only, since any toMatchScreenshot file diffs on non-Linux font antialiasing). References live
// in test/expected/ConfigurationsPane/ and MUST be generated in Docker (npm run test:update:docker).
//
// The pane loads its names asynchronously through the injected `service`, so unlike the synchronous
// Modal/ConfigurationButtons visual tests we render via vitest-browser-react and vi.waitFor the loaded
// DOM before capturing. The initial selection is steered via the remember-cookie (same trick as the
// behavior suite) so we never have to operate the async dropdown. Each state is mounted under a
// fixed-width .sbb-ui host so the sbb-btn control tokens resolve and the flex row lays out the same way
// every run. We screenshot the .configurations-pane element.

// The create/rename editor autofocuses its text input, whose blinking caret changes pixels every frame
// and would stop toMatchScreenshot from ever settling. Hide the caret (invisible in a static reference
// anyway) so the editor captures are deterministic.
beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = 'input { caret-color: transparent !important; }';
  document.head.appendChild(style);
});

type Content = { name: string };

const GLOBAL_NAMES = [
  { name: 'Default', scope: '' },
  { name: 'Requirements', scope: '' },
  { name: 'Test Cases', scope: '' },
];

function makeService(over: Partial<ConfigurationsService<Content>> = {}): ConfigurationsService<Content> {
  return {
    loadConfigurationNames: vi.fn(async () => GLOBAL_NAMES),
    loadContent: vi.fn(async (name: string) => ({ name })),
    createConfiguration: vi.fn(async () => {}),
    renameConfiguration: vi.fn(async () => {}),
    deleteConfiguration: vi.fn(async () => {}),
    ...over,
  };
}

const pane = () => document.querySelector('.configurations-pane') as HTMLElement | null;
const note = () => document.querySelector('.config-note');
const alertError = () => document.querySelector('.alert-error');
const nameInput = () => document.querySelector('.config-edit-row input[type="text"]') as HTMLInputElement | null;
const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.configurations-pane button'));
const btn = (text: string): HTMLButtonElement => {
  const b = buttons().find((x) => (x.textContent ?? '').trim() === text);
  if (!b) throw new Error(`button "${text}" not found`);
  return b;
};

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
  cookie?: string;
}

async function mount(opts: Opts = {}) {
  if (opts.cookie) document.cookie = `ck-visual=${opts.cookie}; path=/`;
  const service = opts.service ?? makeService();
  // The pane is token-driven (sbb-btn control tokens, --sbb-* muted-text on the note), so it only
  // renders styled under a .sbb-ui scope. The fixed width keeps the flex row on one line so the layout
  // is deterministic across runs. (`T` is inferred as Content from the typed `service` prop, so the
  // explicit generic argument is omitted - it does not parse when the element is a nested JSX child.)
  render(
    <div className="sbb-ui config-visual-host" style={{ width: '900px' }}>
      <ConfigurationsPane
        scope={opts.scope ?? ''}
        service={service}
        cookieKey="ck-visual"
        label={opts.label}
        onContentLoaded={() => {}}
        onSelectedChange={() => {}}
        onEditingNameChange={() => {}}
      />
    </div>,
  );
  await vi.waitFor(() => expect(pane()).not.toBeNull());
  return { service };
}

const shot = (name: string) => expect(page.elementLocator(pane() as HTMLElement)).toMatchScreenshot(name);

afterEach(() => {
  cleanup();
  clearCookies();
  vi.restoreAllMocks();
});

describe('ConfigurationsPane visual states - view mode', () => {
  it('Default selected at global scope (Default note, Rename/Delete disabled)', async () => {
    await mount();
    await vi.waitFor(() => expect(note()?.textContent).toContain("The Default configuration can't be renamed"));
    await shot('default-selected');
  });

  it('a regular configuration selected (no note, Rename/Delete enabled)', async () => {
    await mount({ cookie: 'Requirements' });
    await vi.waitFor(() => expect(btn('Rename').disabled).toBe(false));
    expect(note()).toBeNull();
    await shot('regular-selected');
  });

  it('inherited-from-global configuration at project scope (inherited note, editing disabled)', async () => {
    const service = makeService({
      loadConfigurationNames: vi.fn(async () => [{ name: 'Global Config', scope: '' }]),
    });
    await mount({ scope: 'project/elibrary/', service, cookie: 'Global Config' });
    await vi.waitFor(() => expect(note()?.textContent).toContain('inherited from the global scope'));
    await shot('inherited-note');
  });

  it('empty configuration list (empty select, Rename/Delete disabled)', async () => {
    const service = makeService({ loadConfigurationNames: vi.fn(async () => []) });
    await mount({ service });
    await vi.waitFor(() => expect(btn('Rename').disabled).toBe(true));
    await shot('empty');
  });

  it('custom label prop ("mapping" as the configuration noun)', async () => {
    await mount({ label: 'mapping' });
    await vi.waitFor(() => expect(note()?.textContent).toContain("The Default mapping can't be renamed"));
    await shot('custom-label');
  });
});

describe('ConfigurationsPane visual states - editor mode', () => {
  it('"Add new" editor open (empty input, Save disabled)', async () => {
    await mount({ cookie: 'Requirements' });
    await vi.waitFor(() => expect(btn('Add new').disabled).toBe(false));
    btn('Add new').click();
    await vi.waitFor(() => expect(nameInput()).not.toBeNull());
    await shot('new-editor');
  });

  it('"Rename" editor open (prefilled with the current name, Update enabled)', async () => {
    await mount({ cookie: 'Requirements' });
    await vi.waitFor(() => expect(btn('Rename').disabled).toBe(false));
    btn('Rename').click();
    await vi.waitFor(() => expect(nameInput()?.value).toBe('Requirements'));
    await shot('rename-editor');
  });

  it('editor showing a name-validation error', async () => {
    await mount({ cookie: 'Requirements' });
    await vi.waitFor(() => expect(btn('Add new').disabled).toBe(false));
    btn('Add new').click();
    await vi.waitFor(() => expect(nameInput()).not.toBeNull());
    await userEvent.fill(nameInput()!, 'bad*name');
    btn('Save').click();
    await vi.waitFor(() => expect(alertError()?.textContent).toContain('Only alphanumeric characters'));
    await shot('name-error');
  });
});

describe('ConfigurationsPane visual states - error banners', () => {
  it('load-error banner when loading the names fails', async () => {
    const service = makeService({
      loadConfigurationNames: vi.fn(async () => {
        throw new Error('nope');
      }),
    });
    await mount({ service });
    await vi.waitFor(() => expect(alertError()?.textContent).toContain('Error occurred loading the list'));
    await shot('load-error');
  });

  it('delete-error banner when deleting a selected configuration fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const service = makeService({
      deleteConfiguration: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    await mount({ service, cookie: 'Requirements' });
    await vi.waitFor(() => expect(btn('Delete').disabled).toBe(false));
    btn('Delete').click();
    await vi.waitFor(() => expect(alertError()?.textContent).toContain('Error occurred while deleting'));
    await shot('delete-error');
  });
});
