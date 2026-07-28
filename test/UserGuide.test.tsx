import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import UserGuide from '../src/components/UserGuide';
import type { SendRequest } from '../src/types';

// UserGuide GETs /user-guide via the injected sendRequest and renders the returned HTML (trusted,
// build-generated). We inject a mock sendRequest per case.

afterEach(cleanup);

const q = (sel: string) => document.querySelector(sel);

describe('UserGuide', () => {
  it('renders the returned help HTML into the markdown article', async () => {
    const sendRequest: SendRequest = vi.fn(async () => new Response('<h2>Guide</h2><p>Body</p>', { status: 200 }));
    render(<UserGuide sendRequest={sendRequest} />);
    await vi.waitFor(() => expect(q('article.markdown-body.user-guide-page')).not.toBeNull());
    const article = q('article.user-guide-page')!;
    expect(article.querySelector('h2')?.textContent).toBe('Guide');
    expect(article.textContent).toContain('Body');
    expect(sendRequest).toHaveBeenCalledWith({ method: 'GET', url: '/user-guide' });
  });

  it('shows an HTTP error when the endpoint is not ok', async () => {
    const sendRequest: SendRequest = vi.fn(async () => new Response('', { status: 404 }));
    render(<UserGuide sendRequest={sendRequest} />);
    await vi.waitFor(() => expect(q('.alert-error')).not.toBeNull());
    expect(q('.alert-error')!.textContent).toContain('Failed to load the user guide (HTTP 404)');
    expect(q('article.user-guide-page')).toBeNull();
  });

  it('shows an error when the request rejects', async () => {
    const sendRequest: SendRequest = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<UserGuide sendRequest={sendRequest} />);
    await vi.waitFor(() => expect(q('.alert-error')).not.toBeNull());
    expect(q('.alert-error')!.textContent).toContain('offline');
  });

  // The effect's `cancelled` flag guards both settle paths. Without it a response arriving after the
  // page was left would set state on a dead component; these two cases pin that the late settle is
  // simply ignored rather than resurrecting content or surfacing an error.
  it('ignores a response that resolves after unmount', async () => {
    let settle!: (response: Response) => void;
    const sendRequest: SendRequest = vi.fn(() => new Promise<Response>((resolve) => (settle = resolve)));
    render(<UserGuide sendRequest={sendRequest} />);
    await vi.waitFor(() => expect(q('.page-body')).not.toBeNull());

    cleanup();
    settle(new Response('<h2>Arrived too late</h2>', { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(q('article.user-guide-page')).toBeNull();
    expect(document.body.textContent).not.toContain('Arrived too late');
  });

  it('ignores a rejection that arrives after unmount', async () => {
    let fail!: (reason: Error) => void;
    const sendRequest: SendRequest = vi.fn(() => new Promise<Response>((_resolve, reject) => (fail = reject)));
    render(<UserGuide sendRequest={sendRequest} />);
    await vi.waitFor(() => expect(q('.page-body')).not.toBeNull());

    cleanup();
    fail(new Error('offline'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(q('.alert-error')).toBeNull();
  });
});
