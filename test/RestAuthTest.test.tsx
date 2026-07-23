import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import RestAuthTest from '../src/components/RestAuthTest';

// RestAuthTest grabs the session token via window.top.getRestApiToken() (injected by the Polarion
// shell; absent standalone) and GETs restApiUrl with the X-Polarion-REST-Token header, rendering the
// raw status + body. We stub top.getRestApiToken and global fetch to drive each branch.

const URL = '/polarion/x/rest/api/version';
const topWin = window.top as unknown as { getRestApiToken?: unknown };

const button = () => document.querySelector('.sbb-btn') as HTMLButtonElement;
const output = () => document.querySelector('.rest-auth-test-output') as HTMLElement | null;

// render() commits asynchronously; wait for the button before interacting.
async function mount() {
  render(<RestAuthTest restApiUrl={URL} />);
  await vi.waitFor(() => expect(button()).not.toBeNull());
}

afterEach(() => {
  cleanup();
  delete topWin.getRestApiToken;
  vi.unstubAllGlobals();
});

describe('RestAuthTest', () => {
  it('renders the heading and the (enabled) test button', async () => {
    await mount();
    expect(document.querySelector('h3')?.textContent).toBe('REST API authentication test');
    expect(button().textContent).toContain('Test REST authentication');
    expect(button().disabled).toBe(false);
    expect(output()).toBeNull();
  });

  it('reports gracefully when top.getRestApiToken() returns no token', async () => {
    delete topWin.getRestApiToken; // ensure absent (standalone / vite dev)
    await mount();
    button().click();
    await vi.waitFor(() => expect(output()).not.toBeNull());
    expect(output()!.textContent).toContain('returned no token');
    expect(output()!.classList.contains('failure')).toBe(true);
  });

  it('reports when reading the token throws', async () => {
    Object.defineProperty(topWin, 'getRestApiToken', {
      configurable: true,
      get() {
        throw new Error('denied');
      },
    });
    await mount();
    button().click();
    await vi.waitFor(() => expect(output()).not.toBeNull());
    expect(output()!.textContent).toContain('Unable to obtain a token');
    expect(output()!.classList.contains('failure')).toBe(true);
  });

  it('sends the token and shows a formatted success response', async () => {
    topWin.getRestApiToken = () => 'the-token';
    const fetchMock = vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response('{"version":"1.2.3"}', { status: 200, statusText: 'OK' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await mount();
    button().click();
    await vi.waitFor(() => expect(output()?.textContent).toContain('HTTP 200'));

    // Called the URL with the token header.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL);
    expect(init?.headers).toMatchObject({ 'X-Polarion-REST-Token': 'the-token' });
    // Body pretty-printed as JSON, success styling.
    expect(output()!.textContent).toContain('"version": "1.2.3"');
    expect(output()!.classList.contains('success')).toBe(true);
  });

  it('shows a failure status for a non-ok response', async () => {
    topWin.getRestApiToken = () => 'tok';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 401, statusText: 'Unauthorized' })),
    );
    await mount();
    button().click();
    await vi.waitFor(() => expect(output()?.textContent).toContain('HTTP 401'));
    expect(output()!.classList.contains('failure')).toBe(true);
  });

  it('reports a network failure and re-enables the button afterwards', async () => {
    topWin.getRestApiToken = () => 'tok';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('boom');
      }),
    );
    await mount();
    button().click();
    await vi.waitFor(() => expect(output()?.textContent).toContain('Request failed'));
    expect(output()!.classList.contains('failure')).toBe(true);
    expect(button().disabled).toBe(false);
  });

  it('disables the button while the request is in flight', async () => {
    topWin.getRestApiToken = () => 'tok';
    let resolveFetch!: (r: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (resolveFetch = resolve))),
    );
    await mount();
    button().click();
    await vi.waitFor(() => expect(button().disabled).toBe(true));
    resolveFetch(new Response('{}', { status: 200 }));
    await vi.waitFor(() => expect(button().disabled).toBe(false));
  });
});
