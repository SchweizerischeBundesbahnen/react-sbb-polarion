import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import RestAuthTest from '../src/components/RestAuthTest';
import { settleBeforeCapture } from './helpers';

// Visual-regression states for the debug-only REST auth test. Kept separate from the behavior tests
// (Docker-only, since any toMatchScreenshot file diffs on non-Linux font antialiasing). References live
// in test/expected/RestAuthTest/ and MUST be generated in Docker (npm run test:update:docker).
//
// The whole point of the stylesheet is the output box: a neutral grey frame that turns green on a 2xx
// and red on anything else. One capture per outcome, plus the untouched state.
//
// The box and the inline <code> spans are monospace, which is why RestAuthTest.css names a concrete
// face - the pinned image resolves the bare `monospace` keyword non-deterministically.

const URL = '/polarion/my-extension/rest/api/version';

const shellToken = (token: string | undefined) => {
  const shell = window.top as unknown as { getRestApiToken?: () => string };
  if (token === undefined) delete shell.getRestApiToken;
  else shell.getRestApiToken = () => token;
};

let container: HTMLDivElement | undefined;

function mount() {
  container = document.createElement('div');
  // .sbb-ui carries the control tokens; .standard-admin-page is what the checkbox/control rules are
  // actually scoped to, and is the wrapper a consuming app puts on an admin surface.
  container.className = 'sbb-ui standard-admin-page';
  container.style.width = '760px';
  container.style.padding = '16px';
  container.style.background = '#fff';
  document.body.appendChild(container);
  render(<RestAuthTest restApiUrl={URL} />, { container });
}

const output = () => document.querySelector('.rest-auth-test-output');
const runButton = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.trim() === 'Test REST authentication',
  )!;

const shot = async (name: string) => {
  await settleBeforeCapture();
  return expect(page.elementLocator(container as HTMLElement)).toMatchScreenshot(name);
};

afterEach(() => {
  cleanup();
  container?.remove();
  container = undefined;
  shellToken(undefined);
  vi.restoreAllMocks();
});

describe.skipIf(!__PIXEL_REFERENCES__)('RestAuthTest visual states', () => {
  it('untouched - explanation and the action button, no output box', async () => {
    mount();
    await vi.waitFor(() => expect(runButton()).toBeTruthy());
    expect(output()).toBeNull();
    await shot('rest-auth-idle');
  });

  it('green output box for a successful call', async () => {
    shellToken('a-session-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: '6.1.2', build: '2026-07-01' }), { status: 200, statusText: 'OK' }),
    );
    mount();
    await vi.waitFor(() => expect(runButton()).toBeTruthy());

    runButton().click();

    await vi.waitFor(() => expect(output()?.className).toContain('success'));
    await shot('rest-auth-success');
  });

  it('red output box when the shell hands out no token', async () => {
    mount();
    await vi.waitFor(() => expect(runButton()).toBeTruthy());

    runButton().click();

    await vi.waitFor(() => expect(output()?.className).toContain('failure'));
    await shot('rest-auth-no-token');
  });

  it('red output box carrying the failing status and body', async () => {
    shellToken('a-session-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Authentication failed', { status: 401, statusText: 'Unauthorized' }),
    );
    mount();
    await vi.waitFor(() => expect(runButton()).toBeTruthy());

    runButton().click();

    await vi.waitFor(() => expect(output()?.textContent).toContain('401'));
    await shot('rest-auth-http-error');
  });
});
