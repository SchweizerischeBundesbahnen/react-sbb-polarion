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
});
