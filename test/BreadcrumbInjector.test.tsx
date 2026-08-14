import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import BreadcrumbInjector from '../src/components/BreadcrumbInjector';

// BreadcrumbInjector renders nothing; its effect injects a <script> into the TOP shell window's <head>
// (window.top, same-origin in the runner). We assert the injected script's id / dataset / src, the
// dedup guard, and that a changed title reaches the bridge rather than being dropped. The injected
// script has a real src that 404s harmlessly - we remove it in afterEach.

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
  delete window.top!.SbbBreadcrumbBridge;
});

describe('BreadcrumbInjector', () => {
  it('injects a configured bridge script into the top shell head', async () => {
    render(<BreadcrumbInjector marker="my-ext" title="My Extension" icon="/polarion/x/icon.svg" />);
    await vi.waitFor(() => expect(script('my-ext')).not.toBeNull());
    const s = script('my-ext')!;
    expect(s.type).toBe('text/javascript');
    expect(s.dataset.marker).toBe('my-ext');
    expect(s.dataset.title).toBe('My Extension');
    expect(s.dataset.icon).toBe('/polarion/x/icon.svg');
  });

  it('resolves the bridge next to the running app, not next to the shell', async () => {
    render(<BreadcrumbInjector marker="rel" title="Rel" icon="/i.svg" />);
    await vi.waitFor(() => expect(script('rel')).not.toBeNull());
    // The app frame's own directory, which is where the extension's build copies the file.
    expect(script('rel')!.src).toBe(new URL('breadcrumb-bridge.js', window.location.href).href);
  });

  it('honors an explicit src override', async () => {
    render(<BreadcrumbInjector marker="ovr" title="Ovr" icon="/i.svg" src="/polarion/custom/bridge.js" />);
    await vi.waitFor(() => expect(script('ovr')).not.toBeNull());
    expect(script('ovr')!.src).toBe(new URL('/polarion/custom/bridge.js', window.location.origin).href);
  });

  it('does not inject a second script for the same marker (dedup guard)', async () => {
    render(<BreadcrumbInjector marker="dup" title="Dup" icon="/i.svg" />);
    await vi.waitFor(() => expect(script('dup')).not.toBeNull());
    // Re-render the same marker; the guard sees the existing id and skips.
    render(<BreadcrumbInjector marker="dup" title="Dup" icon="/i.svg" />);
    await vi.waitFor(() => expect(script('dup')).not.toBeNull());
    expect(topHead().querySelectorAll('#dup-breadcrumb-bridge')).toHaveLength(1);
  });

  it('updates the pending script config when the title changes before the bridge has loaded', async () => {
    // A host that relabels on click, so the prop change goes through a real re-render (render()
    // returns a Promise in browser mode, so we avoid destructuring a rerender off it).
    function Host() {
      const [second, setSecond] = useState(false);
      return (
        <div>
          <button type="button" data-testid="relabel" onClick={() => setSecond(true)}>
            relabel
          </button>
          <BreadcrumbInjector marker="pend" title={second ? 'Second' : 'First'} icon={second ? '/b.svg' : '/a.svg'} />
        </div>
      );
    }
    render(<Host />);
    await vi.waitFor(() => expect(script('pend')!.dataset.title).toBe('First'));

    document.querySelector<HTMLButtonElement>('[data-testid="relabel"]')!.click();

    // Still one script, now carrying the new config - the bridge reads these attributes when it runs.
    await vi.waitFor(() => expect(script('pend')!.dataset.title).toBe('Second'));
    expect(script('pend')!.dataset.icon).toBe('/b.svg');
    expect(topHead().querySelectorAll('#pend-breadcrumb-bridge')).toHaveLength(1);
  });

  it('renders a sub-topic breadcrumb when a parent is given', async () => {
    render(<BreadcrumbInjector marker="sub" title="Collections" parent="Diff Tool" icon="/i.svg" />);
    await vi.waitFor(() => expect(script('sub')).not.toBeNull());
    expect(script('sub')!.dataset.parent).toBe('Diff Tool');
  });

  it('omits data-parent for a root topic, which is how the bridge tells the two apart', async () => {
    render(<BreadcrumbInjector marker="root" title="Diff Tool" icon="/i.svg" />);
    await vi.waitFor(() => expect(script('root')).not.toBeNull());
    expect(script('root')!.hasAttribute('data-parent')).toBe(false);
  });

  it('clears the parent when navigating from a sub-topic back to a root one', async () => {
    // A host that drops the parent on click, which is the sub-topic -> root navigation.
    function Host() {
      const [root, setRoot] = useState(false);
      return (
        <div>
          <button type="button" data-testid="to-root" onClick={() => setRoot(true)}>
            root
          </button>
          <BreadcrumbInjector marker="nav" title="Diff Tool" parent={root ? undefined : 'Parent'} icon="/i.svg" />
        </div>
      );
    }
    render(<Host />);
    await vi.waitFor(() => expect(script('nav')!.dataset.parent).toBe('Parent'));

    document.querySelector<HTMLButtonElement>('[data-testid="to-root"]')!.click();

    await vi.waitFor(() => expect(script('nav')!.hasAttribute('data-parent')).toBe(false));
  });

  it('re-installs through the loaded bridge instead of injecting again', async () => {
    const install = vi.fn();
    window.top!.SbbBreadcrumbBridge = { install };

    render(<BreadcrumbInjector marker="live" title="Live" icon="/i.svg" />);
    await vi.waitFor(() =>
      expect(install).toHaveBeenCalledWith({ marker: 'live', title: 'Live', icon: '/i.svg', parent: undefined }),
    );
    // The bridge is already there, so no script is added for it.
    expect(script('live')).toBeNull();
  });
});
