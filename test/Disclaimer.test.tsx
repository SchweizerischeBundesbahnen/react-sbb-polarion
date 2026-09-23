import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import Disclaimer from '../src/components/Disclaimer';
import type { SendRequest } from '../src/types';

// Disclaimer GETs /disclaimer via the injected sendRequest. An empty body means "not generated" and shows
// a fallback (with a source link when given); a non-empty body is rendered as the trusted article.

afterEach(cleanup);

const q = (sel: string) => document.querySelector(sel);

describe('Disclaimer', () => {
  it('renders the returned disclaimer HTML into the markdown article', async () => {
    const sendRequest: SendRequest = vi.fn(async () => new Response('<h2>Terms</h2><p>As is.</p>', { status: 200 }));
    render(<Disclaimer sendRequest={sendRequest} />);
    await vi.waitFor(() => expect(q('article.markdown-body.user-guide-page')).not.toBeNull());
    expect(q('article')!.textContent).toContain('Terms');
    expect(sendRequest).toHaveBeenCalledWith({ method: 'GET', url: '/disclaimer' });
  });

  it('shows the "not generated" fallback with a source link on an empty body', async () => {
    const sendRequest: SendRequest = vi.fn(async () => new Response('', { status: 200 }));
    render(<Disclaimer sendRequest={sendRequest} sourceUrl="https://example.com/DISCLAIMER.md" />);
    await vi.waitFor(() => expect(document.body.textContent).toContain('No disclaimer has been generated'));
    expect(q('a[href="https://example.com/DISCLAIMER.md"]')).not.toBeNull();
    expect(q('article')).toBeNull();
  });

  it('shows a plain fallback (no link) when no sourceUrl is given', async () => {
    const sendRequest: SendRequest = vi.fn(async () => new Response('', { status: 404 }));
    render(<Disclaimer sendRequest={sendRequest} />);
    await vi.waitFor(() => expect(document.body.textContent).toContain('No disclaimer has been generated'));
    // No source link (the source link is the only target=_blank anchor; PageLayout's own back link is not).
    expect(q('a[target="_blank"]')).toBeNull();
  });

  it('treats a rejected request as not generated', async () => {
    const sendRequest: SendRequest = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<Disclaimer sendRequest={sendRequest} sourceUrl="https://example.com/DISCLAIMER.md" />);
    await vi.waitFor(() => expect(document.body.textContent).toContain('No disclaimer has been generated'));
  });
});
