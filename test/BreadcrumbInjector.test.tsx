import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import BreadcrumbInjector from '../src/components/BreadcrumbInjector';

// BreadcrumbInjector renders nothing; its effect injects a <script> into the TOP shell window's <head>
// (window.top, same-origin in the runner). We assert the injected script's id / dataset / src, and the
// dedup guard. The injected script has a real src that 404s harmlessly - we remove it in afterEach.

const topHead = () => window.top!.document.head;
const script = (marker: string) =>
  window.top!.document.getElementById(`${marker}-breadcrumb-bridge`) as HTMLScriptElement | null;

function removeInjected() {
  topHead()
    .querySelectorAll('script[id$="-breadcrumb-bridge"]')
    .forEach((s) => s.remove());
}

afterEach(() => {
  cleanup();
  removeInjected();
});

describe('BreadcrumbInjector', () => {
  it('injects a configured BreadcrumbBridge script into the top shell head', async () => {
    render(<BreadcrumbInjector marker="my-ext" title="My Extension" icon="/polarion/x/icon.svg" />);
    await vi.waitFor(() => expect(script('my-ext')).not.toBeNull());
    const s = script('my-ext')!;
    expect(s.type).toBe('text/javascript');
    expect(s.src).toMatch(/BreadcrumbBridge\.js$/);
    expect(s.dataset.marker).toBe('my-ext');
    expect(s.dataset.title).toBe('My Extension');
    expect(s.dataset.icon).toBe('/polarion/x/icon.svg');
  });

  it('does not inject a second script for the same marker (dedup guard)', async () => {
    render(<BreadcrumbInjector marker="dup" title="Dup" icon="/i.svg" />);
    await vi.waitFor(() => expect(script('dup')).not.toBeNull());
    // Re-render the same marker; the guard sees the existing id and skips.
    render(<BreadcrumbInjector marker="dup" title="Dup" icon="/i.svg" />);
    await vi.waitFor(() => expect(script('dup')).not.toBeNull());
    expect(topHead().querySelectorAll('#dup-breadcrumb-bridge')).toHaveLength(1);
  });
});
