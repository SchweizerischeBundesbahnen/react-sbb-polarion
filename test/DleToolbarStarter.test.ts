import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Classic script that registers window.CommonDleToolbarStarter on load; importing it for its side
// effect exposes that global. It also captures its registries off `top` at load time, so the tests
// clear those by key and never reassign them.
import '../src/shell/DleToolbarStarter.js';
import type { DleToolbarConfig } from '../src/shell/DleToolbarStarter.js';

// In production the engine runs inside Polarion's document-editor iframe and drives the shell through
// `top`: it reads `top.document` for the toolbar DOM, but its own `document` for the inject <script>
// tags that decide button order. Vitest browser mode reproduces exactly that split, because the test
// module runs in a child frame of the runner page. So the Polarion DOM is built in `top.document`
// (inside a host element we remove again) and the inject scripts go into this frame's head.
const topWindow = window.top!;
const topDocument = topWindow.document;

const engine = () => window.CommonDleToolbarStarter!;
const byId = (id: string) => topDocument.getElementById(id);
const toolbarRow = () => topDocument.querySelector('table.polarion-dle-ToolbarPanel tr')!;
const injectedIds = () => [...toolbarRow().children].map((cell) => cell.id).filter(Boolean);

let host: HTMLElement;
let addedScripts: HTMLScriptElement[] = [];
let rafCallbacks: FrameRequestCallback[] = [];

/** Full Polarion DLE toolbar sub-tree the selectors expect; flags omit a piece to hit early returns. */
function dleHtml({ toolbar = true, spacer = true, richText = true } = {}) {
  const spacerCell = spacer ? '<td width="100%"></td>' : '';
  const toolbarRowHtml = toolbar
    ? `<div class="polarion-rte-ToolbarPanelWrapper">
         <table class="polarion-dle-ToolbarPanel"><tbody>
           <tr><td class="existing-tool"></td>${spacerCell}</tr>
         </tbody></table>
       </div>`
    : '';
  const richTextPanel = richText
    ? `<div class="polarion-dle-SplitPanel">first</div>
       <div class="polarion-dle-SplitPanel">
         <div class="rta-wrapper"><div class="rta-inner">
           <div class="polarion-dle-RichTextArea"></div>
         </div></div>
       </div>`
    : '';
  return `<div class="polarion-content-container"><div class="polarion-Container">
            <div class="polarion-dle-Container"><div class="polarion-dle-Wrapper">
              <div class="polarion-dle-RpcPanel"><div class="polarion-dle-MainDockPanel">
                ${toolbarRowHtml}${richTextPanel}
              </div></div>
            </div></div>
          </div></div>`;
}

/** Rich Page (Live Report) sub-tree: preview toolbar row, view/edit marker, optional expand handle. */
function rpeHtml({ toolbar = true, view = true, spacer = true, expandHandle = false, handleHidden = false } = {}) {
  const spacerCell = spacer ? '<td width="100%"></td>' : '';
  const toolbarRowHtml = toolbar
    ? `<div class="polarion-rte-ToolbarPanelWrapper">
         <table class="polarion-dle-ToolbarPanel"><tbody>
           <tr><td class="existing-tool"></td>${spacerCell}</tr>
         </tbody></table>
       </div>`
    : '';
  const content = view ? '<div class="polarion-rpe-view"></div>' : '<div class="polarion-rpe-edit"></div>';
  const handle = expandHandle
    ? `<div class="polarion-rpe-expandTools"${handleHidden ? ' style="display: none;"' : ''}><span>Expand Tools</span></div>`
    : '';
  return `<div class="polarion-content-container">
            <div class="polarion-rpe-MainPanel">${toolbarRowHtml}${content}${handle}</div>
          </div>`;
}

const setHtml = (html: string) => {
  host.innerHTML = html;
};

const cfg = (over: Partial<DleToolbarConfig> = {}): DleToolbarConfig => ({
  markerId: 'my-btn',
  html: '<button>A</button>',
  ...over,
});

/** Inject scripts in configured order; the engine derives button order from their DOM position. */
function addInjectScripts(...contexts: string[]) {
  for (const context of contexts) {
    addScript(`/polarion/${context}/js/dle-toolbar.js?timestamp=1`);
  }
}

function addScript(src: string | null) {
  const script = document.createElement('script');
  if (src !== null) {
    script.setAttribute('src', src);
  }
  document.head.appendChild(script);
  addedScripts.push(script);
}

/** MutationObserver callbacks are microtasks; a macrotask turn flushes them. */
const flushObserver = () => new Promise((resolve) => setTimeout(resolve, 0));
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const registry = () => topWindow.__genericDleToolbarObservers!;

beforeEach(() => {
  host = topDocument.createElement('div');
  topDocument.body.appendChild(host);
  rafCallbacks = [];
  // Faked so the coalesced self-healing re-inject can be driven deterministically, and so a test can
  // assert that nothing was scheduled at all.
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    rafCallbacks.push(callback);
    return 0;
  });
});

afterEach(() => {
  // Clear the closed-over registries by key; never reassign, the module captured the objects.
  const observers = topWindow.__genericDleToolbarObservers;
  if (observers) {
    Object.keys(observers).forEach((key) => {
      observers[key].disconnect();
      delete observers[key];
    });
  }
  for (const map of [topWindow.__genericDleToolbarOrder, topWindow.__genericDleToolbarOwners]) {
    if (map) Object.keys(map).forEach((key) => delete map[key]);
  }
  if (topWindow.__genericRpeAutoExpandObserver) {
    topWindow.__genericRpeAutoExpandObserver.disconnect();
    delete topWindow.__genericRpeAutoExpandObserver;
  }
  host.remove();
  addedScripts.forEach((script) => script.remove());
  addedScripts = [];
  ['generic-dle-toolbar-styles', 'sbb-css', 'sbb-js'].forEach((id) => topDocument.getElementById(id)?.remove());
  topDocument.getElementById('pdf-exporter-toolbar-injected')?.remove();
  topDocument.getElementById('docx-exporter-toolbar-injected')?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CommonDleToolbarStarter', () => {
  it('injects the button as a <td> before the spacer cell', () => {
    setHtml(dleHtml());
    engine().create(cfg()).injectToolbar();

    const cell = byId('my-btn')!;
    expect(cell).not.toBeNull();
    expect(cell.tagName).toBe('TD');
    expect(cell.innerHTML).toBe('<button>A</button>');
    expect(cell.nextElementSibling!.getAttribute('width')).toBe('100%'); // sits before the spacer
  });

  it('is idempotent, a second inject with the button present is a no-op', () => {
    setHtml(dleHtml());
    const starter = engine().create(cfg());
    starter.injectToolbar();
    starter.injectToolbar();
    expect(topDocument.querySelectorAll('#my-btn')).toHaveLength(1);
  });

  // An administrator can configure the same injector twice - Administration > Properties and
  // polarion.properties both carry a scriptInjection - and then this engine is evaluated twice in one
  // page. The two loads must agree on the capture-phase listener that a disabled button swallows clicks
  // with, or the first load's listener outlives the second load's re-enable: the button looks enabled,
  // highlights on hover, and does nothing when clicked, with nothing in the console.
  it('re-enables a button whose disabled state came from another load of the engine', async () => {
    setHtml(dleHtml());
    const first = engine();
    // A second evaluation of the same file, which is what a duplicated script tag produces.
    await import('../src/shell/DleToolbarStarter.js?second-load');
    const second = engine();
    expect(second, 'the second load did not replace the global').not.toBe(first);

    first.create(cfg()).injectToolbar({ disabled: true });
    const clicked = vi.fn();
    byId('my-btn')!.querySelector('button')!.addEventListener('click', clicked);

    // The permission check of the second instance answers, and it owns the marker now.
    second.create(cfg()).setDisabled(false);

    byId('my-btn')!.querySelector('button')!.click();
    expect(byId('my-btn')!.classList.contains('dleToolBarDisabled')).toBe(false);
    expect(clicked, 'a listener from the other engine load is still swallowing the click').toHaveBeenCalledTimes(1);
  });

  it('does nothing when the toolbar row is not rendered yet', () => {
    setHtml(dleHtml({ toolbar: false }));
    engine().create(cfg()).injectToolbar();
    expect(byId('my-btn')).toBeNull();
  });

  it('appends at the end and warns when the spacer cell is missing', () => {
    setHtml(dleHtml({ spacer: false }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    engine().create(cfg()).injectToolbar();

    expect(toolbarRow().lastElementChild!.id).toBe('my-btn'); // appended at the end
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('my-btn');
  });

  it('orders buttons by the DOM position of their inject scripts, ignoring a race-prone config.order', () => {
    setHtml(dleHtml());
    // Scripts are in configured order pdf, docx, strictdoc...
    addInjectScripts('pdf-exporter', 'docx-exporter', 'strictdoc-exporter');
    // ...but the create() calls arrive in onload-race order (reversed) with misleading orders.
    engine()
      .create(cfg({ markerId: 'strictdoc-exporter-toolbar-injected', order: 1 }))
      .injectToolbar();
    engine()
      .create(cfg({ markerId: 'docx-exporter-toolbar-injected', order: 2 }))
      .injectToolbar();
    engine()
      .create(cfg({ markerId: 'pdf-exporter-toolbar-injected', order: 3 }))
      .injectToolbar();

    expect(injectedIds()).toEqual([
      'pdf-exporter-toolbar-injected',
      'docx-exporter-toolbar-injected',
      'strictdoc-exporter-toolbar-injected',
    ]);
  });

  it('heals to the configured order after a re-render regardless of re-inject timing', () => {
    setHtml(dleHtml());
    addInjectScripts('pdf-exporter', 'docx-exporter');
    const pdf = engine().create(cfg({ markerId: 'pdf-exporter-toolbar-injected', order: 5 }));
    const docx = engine().create(cfg({ markerId: 'docx-exporter-toolbar-injected', order: 0 }));
    pdf.injectToolbar();
    docx.injectToolbar();
    // GWT wipes both, then docx re-injects before pdf; order must still be pdf, docx.
    byId('pdf-exporter-toolbar-injected')!.remove();
    byId('docx-exporter-toolbar-injected')!.remove();
    docx.injectToolbar();
    pdf.injectToolbar();

    expect(injectedIds()).toEqual(['pdf-exporter-toolbar-injected', 'docx-exporter-toolbar-injected']);
  });

  it('falls back to config.order when no inject script matches (a bespoke create() caller)', () => {
    setHtml(dleHtml());
    engine()
      .create(cfg({ markerId: 'btn-high', order: 10 }))
      .injectToolbar();
    engine()
      .create(cfg({ markerId: 'btn-low', order: 0 }))
      .injectToolbar();

    const ids = [...toolbarRow().children].map((cell) => cell.id);
    expect(ids.indexOf('btn-low')).toBeLessThan(ids.indexOf('btn-high'));
  });

  it('ignores non-inject scripts (engine script, empty or foreign src) when deriving the order', () => {
    setHtml(dleHtml());
    addScript(null); // src-less <script>
    addScript('/polarion/pdf-exporter-app/ui/app/dle-toolbar-starter.js'); // the engine itself
    addScript('/some/unrelated/app.js'); // foreign script
    addInjectScripts('pdf-exporter', 'docx-exporter'); // the real injectors
    engine()
      .create(cfg({ markerId: 'docx-exporter-toolbar-injected', order: 9 }))
      .injectToolbar();
    engine()
      .create(cfg({ markerId: 'pdf-exporter-toolbar-injected', order: 9 }))
      .injectToolbar();

    expect(injectedIds()).toEqual(['pdf-exporter-toolbar-injected', 'docx-exporter-toolbar-injected']);
  });

  it('dedupes multiple inject scripts of the same extension (dle-toolbar.js + starter.js)', () => {
    setHtml(dleHtml());
    // Each extension ships both a dle-toolbar.js and a starter.js; they must count as one context.
    addScript('/polarion/pdf-exporter/js/dle-toolbar.js');
    addScript('/polarion/pdf-exporter/js/starter.js');
    addScript('/polarion/docx-exporter/js/dle-toolbar.js');
    addScript('/polarion/docx-exporter/js/starter.js');
    engine()
      .create(cfg({ markerId: 'docx-exporter-toolbar-injected' }))
      .injectToolbar();
    engine()
      .create(cfg({ markerId: 'pdf-exporter-toolbar-injected' }))
      .injectToolbar();

    expect(injectedIds()).toEqual(['pdf-exporter-toolbar-injected', 'docx-exporter-toolbar-injected']);
  });

  it('is not confused by a context named like an Object prototype key', () => {
    setHtml(dleHtml());
    // 'constructor' as an extension context must be a normal, distinct segment (regression guard for
    // using a Set rather than a plain-object seen-map).
    addInjectScripts('constructor', 'pdf-exporter');
    engine()
      .create(cfg({ markerId: 'pdf-exporter-toolbar-injected' }))
      .injectToolbar();
    engine()
      .create(cfg({ markerId: 'constructor-toolbar-injected' }))
      .injectToolbar();

    expect(injectedIds()).toEqual(['constructor-toolbar-injected', 'pdf-exporter-toolbar-injected']);
  });

  it('picks the longest matching context prefix for the markerId', () => {
    setHtml(dleHtml());
    // Two contexts both prefix the marker id; the longer, more specific one wins.
    addInjectScripts('pdf-exporter', 'pdf-exporter-plus');
    engine()
      .create(cfg({ markerId: 'pdf-exporter-plus-toolbar-injected', order: 99 }))
      .injectToolbar();
    // 'pdf-exporter-plus' is at DOM index 1, so the button records order 1, not 0 (the shorter match).
    expect(topWindow.__genericDleToolbarOrder!['pdf-exporter-plus-toolbar-injected']).toBe(1);
  });

  describe('disabled state and permission check', () => {
    const isDisabled = () => {
      const el = byId('my-btn')!;
      return el.classList.contains('dleToolBarDisabled') && el.getAttribute('aria-disabled') === 'true';
    };

    it('injects disabled when injectToolbar({disabled: true})', () => {
      setHtml(dleHtml());
      engine().create(cfg()).injectToolbar({ disabled: true });
      expect(isDisabled()).toBe(true);
    });

    it('injects enabled by default and setDisabled toggles the live button both ways', () => {
      setHtml(dleHtml());
      const starter = engine().create(cfg());
      starter.injectToolbar();
      expect(isDisabled()).toBe(false);
      starter.setDisabled(true);
      expect(isDisabled()).toBe(true);
      starter.setDisabled(false);
      expect(isDisabled()).toBe(false);
    });

    it('swallows keyboard and programmatic clicks while disabled (capture blocker)', () => {
      setHtml(dleHtml());
      const starter = engine().create(cfg({ html: '<button id="inner">A</button>' }));
      starter.injectToolbar({ disabled: true });
      const inner = byId('inner')!;
      const onClick = vi.fn();
      inner.addEventListener('click', onClick);

      inner.click(); // programmatic click reaches the container blocker
      expect(onClick).not.toHaveBeenCalled(); // ...which stops it before the button handler

      starter.setDisabled(false);
      inner.click();
      expect(onClick).toHaveBeenCalledTimes(1); // enabled again, click passes through
    });

    it('marks inner interactive elements aria-disabled and drops them from the tab order', () => {
      setHtml(dleHtml());
      const starter = engine().create(cfg({ html: '<div id="inner" role="button" tabindex="0">A</div>' }));
      starter.injectToolbar({ disabled: true });
      const inner = byId('inner')!;
      expect(inner.getAttribute('aria-disabled')).toBe('true');
      expect(inner.getAttribute('tabindex')).toBe('-1');

      starter.setDisabled(false);
      expect(inner.hasAttribute('aria-disabled')).toBe(false);
      expect(inner.getAttribute('tabindex')).toBe('0'); // original tabindex restored
    });

    it("preserves the markup's own aria-disabled on re-enable instead of clobbering it", () => {
      setHtml(dleHtml());
      const starter = engine().create(cfg({ html: '<button id="inner" aria-disabled="true">A</button>' }));
      starter.injectToolbar({ disabled: true });
      expect(byId('inner')!.getAttribute('aria-disabled')).toBe('true');
      starter.setDisabled(false);
      // engine restores the markup's original value, it does not remove it
      expect(byId('inner')!.getAttribute('aria-disabled')).toBe('true');
    });

    it('removes an aria-disabled it added when the element had none originally', () => {
      setHtml(dleHtml());
      const starter = engine().create(cfg({ html: '<button id="inner">A</button>' }));
      starter.injectToolbar({ disabled: true });
      expect(byId('inner')!.getAttribute('aria-disabled')).toBe('true');
      starter.setDisabled(false);
      expect(byId('inner')!.hasAttribute('aria-disabled')).toBe(false);
    });

    it('removes a tabindex it added when the element had none originally', () => {
      setHtml(dleHtml());
      const starter = engine().create(cfg({ html: '<button id="inner">A</button>' }));
      starter.injectToolbar({ disabled: true });
      expect(byId('inner')!.getAttribute('tabindex')).toBe('-1');
      starter.setDisabled(false);
      expect(byId('inner')!.hasAttribute('tabindex')).toBe(false);
    });

    it('destroy() clears the disabled state and its click blocker from the element', () => {
      setHtml(dleHtml());
      const starter = engine().create(cfg({ html: '<button id="inner">A</button>' }));
      starter.injectToolbar({ disabled: true });
      const inner = byId('inner')!;
      const onClick = vi.fn();
      inner.addEventListener('click', onClick);

      starter.destroy();
      expect(byId('my-btn')!.classList.contains('dleToolBarDisabled')).toBe(false);
      inner.click();
      expect(onClick).toHaveBeenCalledTimes(1); // blocker removed, click passes
    });

    it('a later injectToolbar() without disabled keeps a previously set disabled state', () => {
      setHtml(dleHtml());
      const starter = engine().create(cfg());
      starter.injectToolbar();
      starter.setDisabled(true);
      // Extension re-injects (e.g. re-runs its bootstrap) without passing disabled.
      byId('my-btn')!.remove();
      starter.injectToolbar();
      expect(isDisabled()).toBe(true); // merged lastParams preserved disabled
    });

    it('keeps the disabled state across a self-healing re-inject', async () => {
      setHtml(dleHtml());
      const starter = engine().create(cfg());
      starter.injectToolbar();
      starter.setDisabled(true);

      byId('my-btn')!.remove(); // GWT wipes the button
      topDocument.querySelector('div.polarion-dle-Container')!.appendChild(topDocument.createElement('span'));
      await flushObserver();
      rafCallbacks.forEach((callback) => callback(0));
      expect(isDisabled()).toBe(true); // healed AND still disabled
    });

    it('permissionCheck(): disables when it resolves false', async () => {
      setHtml(dleHtml());
      engine()
        .create(cfg({ permissionCheck: () => Promise.resolve(false) }))
        .injectToolbar();
      expect(isDisabled()).toBe(true); // disabled while pending
      await flushPromises();
      expect(isDisabled()).toBe(true); // stays disabled, not permitted
    });

    it('permissionCheck(): enables when it resolves true', async () => {
      setHtml(dleHtml());
      engine()
        .create(cfg({ permissionCheck: () => Promise.resolve(true) }))
        .injectToolbar();
      expect(isDisabled()).toBe(true); // disabled while pending (no flicker)
      await flushPromises();
      expect(isDisabled()).toBe(false); // enabled, permitted
    });

    it('permissionCheck(): fail-closed when it rejects', async () => {
      setHtml(dleHtml());
      engine()
        .create(cfg({ permissionCheck: () => Promise.reject(new Error('boom')) }))
        .injectToolbar();
      await flushPromises();
      expect(isDisabled()).toBe(true);
    });

    it('permissionCheckUrl(): enables on { permitted: true }', async () => {
      setHtml(dleHtml());
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ permitted: true }) });
      vi.stubGlobal('fetch', fetchMock);

      engine()
        .create(cfg({ permissionCheckUrl: '/perm' }))
        .injectToolbar();
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('/perm');
      expect(isDisabled()).toBe(false);
    });

    it('permissionCheckUrl(): disables on { permitted: false }', async () => {
      setHtml(dleHtml());
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ permitted: false }) }),
      );

      engine()
        .create(cfg({ permissionCheckUrl: '/perm' }))
        .injectToolbar();
      await flushPromises();
      expect(isDisabled()).toBe(true);
    });

    it('permissionCheckUrl(): fail-closed on a non-OK response', async () => {
      setHtml(dleHtml());
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));

      engine()
        .create(cfg({ permissionCheckUrl: '/perm' }))
        .injectToolbar();
      await flushPromises();
      expect(isDisabled()).toBe(true);
    });

    it('permissionCheck takes precedence over permissionCheckUrl', async () => {
      setHtml(dleHtml());
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ permitted: false }) });
      vi.stubGlobal('fetch', fetchMock);

      engine()
        .create(cfg({ permissionCheck: () => true, permissionCheckUrl: '/perm' }))
        .injectToolbar();
      await flushPromises();

      expect(fetchMock).not.toHaveBeenCalled(); // URL not used
      expect(isDisabled()).toBe(false); // function said permitted
    });

    it('setDisabled is a no-op (no throw) when the button is not currently in the DOM', () => {
      setHtml(dleHtml({ toolbar: false })); // toolbar absent, nothing injected
      const starter = engine().create(cfg());
      starter.injectToolbar();
      expect(byId('my-btn')).toBeNull();
      expect(() => starter.setDisabled(true)).not.toThrow();
    });

    it('a superseded starter instance does not apply setDisabled (newer owner wins)', () => {
      setHtml(dleHtml());
      const oldStarter = engine().create(cfg());
      oldStarter.injectToolbar();
      // A newer starter for the SAME markerId is created, so it becomes the owner.
      const newStarter = engine().create(cfg());
      newStarter.injectToolbar();

      oldStarter.setDisabled(true); // stale instance, must be a no-op
      expect(isDisabled()).toBe(false);
      newStarter.setDisabled(true); // current owner, applies
      expect(isDisabled()).toBe(true);
    });

    it('does not apply a permission result that resolves after destroy()', async () => {
      setHtml(dleHtml());
      let resolveCheck: (permitted: boolean) => void = () => {};
      const starter = engine().create(
        cfg({
          permissionCheck: () =>
            new Promise<boolean>((resolve) => {
              resolveCheck = resolve;
            }),
        }),
      );
      starter.injectToolbar();
      await flushPromises(); // let permissionCheck get invoked (sets resolveCheck)
      expect(isDisabled()).toBe(true); // disabled while pending

      starter.destroy(); // torn down before the check resolves
      resolveCheck(true); // late "permitted" result
      await flushPromises();
      // destroy() cleared the disabled state and the late result must not re-apply anything.
      expect(byId('my-btn')!.classList.contains('dleToolBarDisabled')).toBe(false);
    });

    it('runs the permission check only once across re-injects', async () => {
      setHtml(dleHtml());
      const check = vi.fn().mockResolvedValue(true);
      const starter = engine().create(cfg({ permissionCheck: check }));
      starter.injectToolbar();
      starter.injectToolbar();
      await flushPromises();
      expect(check).toHaveBeenCalledTimes(1);
    });
  });

  it('re-injects the button when the toolbar re-renders (self-healing observer)', async () => {
    setHtml(dleHtml());
    engine().create(cfg()).injectToolbar();
    expect(byId('my-btn')).not.toBeNull();

    byId('my-btn')!.remove(); // GWT wipes the button
    topDocument.querySelector('div.polarion-dle-Container')!.appendChild(topDocument.createElement('span'));
    await flushObserver();

    expect(rafCallbacks.length).toBeGreaterThan(0); // a coalesced re-inject was queued
    rafCallbacks.forEach((callback) => callback(0));
    expect(byId('my-btn')).not.toBeNull(); // healed
  });

  it('the observer stays idle while the button is still present', async () => {
    setHtml(dleHtml());
    engine().create(cfg()).injectToolbar();

    topDocument.querySelector('div.polarion-dle-Container')!.appendChild(topDocument.createElement('span'));
    await flushObserver();
    expect(rafCallbacks).toHaveLength(0); // fast-path: button present, nothing scheduled
  });

  it('falls back to observing document.body when the stable ancestor is absent', async () => {
    setHtml(''); // no toolbar, no ancestor
    engine().create(cfg()).injectToolbar(); // inject early-returns, observer still armed on body
    expect(registry()['my-btn']).toBeDefined();

    host.appendChild(topDocument.createElement('span'));
    await flushObserver();
    expect(rafCallbacks.length).toBeGreaterThan(0); // observing body works
  });

  it('sets up no observer when neither the stable ancestor nor document.body exist', () => {
    setHtml('');
    // Both the ancestor selector and top.document.body resolve to nothing.
    const realBody = topDocument.body;
    Object.defineProperty(topDocument, 'body', { configurable: true, get: () => null });
    try {
      engine().create(cfg()).injectToolbar();
      expect(registry()['my-btn']).toBeUndefined(); // no anchor, observer not installed
    } finally {
      Object.defineProperty(topDocument, 'body', { configurable: true, get: () => realBody });
    }
  });

  it('destroy() disconnects the observer and drops it from the registry', () => {
    setHtml(dleHtml());
    const starter = engine().create(cfg());
    starter.injectToolbar();
    expect(registry()['my-btn']).toBeDefined();

    starter.destroy();
    expect(registry()['my-btn']).toBeUndefined();
    expect(() => starter.destroy()).not.toThrow(); // second destroy with nothing registered is harmless
  });

  it('re-installs the observer after destroy (observerSetUp resets)', () => {
    setHtml(dleHtml());
    const starter = engine().create(cfg());
    starter.injectToolbar();
    starter.destroy();
    starter.injectToolbar(); // sets a fresh observer up again
    expect(registry()['my-btn']).toBeDefined();
  });

  it('disconnects a leftover observer when the same markerId is re-created', () => {
    setHtml(dleHtml());
    engine().create(cfg()).injectToolbar();
    const firstObserver = registry()['my-btn'];
    const disconnect = vi.spyOn(firstObserver, 'disconnect');

    engine().create(cfg()).injectToolbar();
    expect(disconnect).toHaveBeenCalledTimes(1); // the previous observer was disconnected
    expect(registry()['my-btn']).not.toBe(firstObserver); // registry now holds the new one
  });

  it('throws on an unknown target', () => {
    expect(() => engine().create(cfg({ target: 'nope' as never }))).toThrow("unknown target 'nope'");
  });

  describe('richPagePreview target', () => {
    it('injects the button into the Rich Page toolbar row before the spacer cell', () => {
      setHtml(rpeHtml());
      engine()
        .create(cfg({ target: 'richPagePreview' }))
        .injectToolbar(); // row injection is implied

      const cell = byId('my-btn')!;
      expect(cell).not.toBeNull();
      expect(cell.tagName).toBe('TD');
      expect(cell.innerHTML).toBe('<button>A</button>');
      expect(cell.nextElementSibling!.getAttribute('width')).toBe('100%');
    });

    it('does not inject while the Rich Page is in edit mode (guard selector)', () => {
      setHtml(rpeHtml({ view: false }));
      engine()
        .create(cfg({ target: 'richPagePreview' }))
        .injectToolbar();
      expect(byId('my-btn')).toBeNull();
    });

    it('does nothing while the toolbar is still collapsed (row absent)', () => {
      setHtml(rpeHtml({ toolbar: false, expandHandle: true }));
      engine()
        .create(cfg({ target: 'richPagePreview' }))
        .injectToolbar();
      expect(byId('my-btn')).toBeNull();
    });

    it('ignores a stale view panel and does not inject into another panel in edit mode', () => {
      // SPA transition: a stale (hidden) panel still carrying the view marker coexists with the
      // active panel that is in edit mode, so nothing may be injected.
      setHtml(
        `<div class="polarion-content-container">
           <div class="polarion-rpe-MainPanel" style="display: none;">
             <div class="polarion-rpe-view"></div>
           </div>
           <div class="polarion-rpe-MainPanel">
             <div class="polarion-rte-ToolbarPanelWrapper">
               <table class="polarion-dle-ToolbarPanel"><tbody>
                 <tr><td class="existing-tool"></td><td width="100%"></td></tr>
               </tbody></table>
             </div>
             <div class="polarion-rpe-edit"></div>
           </div>
         </div>`,
      );
      engine()
        .create(cfg({ target: 'richPagePreview' }))
        .injectToolbar();
      expect(byId('my-btn')).toBeNull();
    });

    it('injects via the observer once the toolbar gets expanded', async () => {
      setHtml(rpeHtml({ toolbar: false, expandHandle: true }));
      engine()
        .create(cfg({ target: 'richPagePreview' }))
        .injectToolbar(); // nothing yet, observer armed

      // "Expand Tools" clicked: GWT replaces the handle with the toolbar.
      const panel = topDocument.querySelector('.polarion-rpe-MainPanel')!;
      panel.querySelector('.polarion-rpe-expandTools')!.remove();
      panel.insertAdjacentHTML(
        'afterbegin',
        `<div class="polarion-rte-ToolbarPanelWrapper">
           <table class="polarion-dle-ToolbarPanel"><tbody>
             <tr><td class="existing-tool"></td><td width="100%"></td></tr>
           </tbody></table>
         </div>`,
      );
      await flushObserver();
      expect(rafCallbacks.length).toBeGreaterThan(0);
      rafCallbacks.forEach((callback) => callback(0));
      expect(byId('my-btn')).not.toBeNull();
    });
  });

  describe('autoExpandRichPageTools', () => {
    it('clicks a visible "Expand Tools" handle on the initial call', () => {
      setHtml(rpeHtml({ toolbar: false, expandHandle: true }));
      const clicked = vi.fn();
      topDocument.querySelector('.polarion-rpe-expandTools')!.addEventListener('click', clicked);

      engine().autoExpandRichPageTools();
      expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('ignores a handle hidden by GWT (inline display:none)', () => {
      setHtml(rpeHtml({ toolbar: false, expandHandle: true, handleHidden: true }));
      const clicked = vi.fn();
      topDocument.querySelector('.polarion-rpe-expandTools')!.addEventListener('click', clicked);

      engine().autoExpandRichPageTools();
      expect(clicked).not.toHaveBeenCalled();
    });

    it('clicks the handle when it appears later (SPA navigation)', async () => {
      setHtml('');
      engine().autoExpandRichPageTools();

      setHtml(rpeHtml({ toolbar: false, expandHandle: true }));
      const clicked = vi.fn();
      topDocument.querySelector('.polarion-rpe-expandTools')!.addEventListener('click', clicked);
      await flushObserver();
      expect(rafCallbacks.length).toBeGreaterThan(0);
      rafCallbacks.forEach((callback) => callback(0));
      expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('ignores a handle hidden by an inline-hidden ancestor (stale SPA panel)', () => {
      setHtml(
        `<div class="polarion-rpe-MainPanel" style="display: none;">
           <div class="polarion-rpe-expandTools"><span>Expand Tools</span></div>
         </div>`,
      );
      const clicked = vi.fn();
      topDocument.querySelector('.polarion-rpe-expandTools')!.addEventListener('click', clicked);

      engine().autoExpandRichPageTools();
      expect(clicked).not.toHaveBeenCalled();
    });

    it('clicks the visible handle even when a stale hidden one comes first in the DOM', () => {
      setHtml(
        `<div class="polarion-rpe-MainPanel" style="display: none;">
           <div class="polarion-rpe-expandTools"><span>Expand Tools</span></div>
         </div>
         <div class="polarion-rpe-MainPanel">
           <div class="polarion-rpe-expandTools"><span>Expand Tools</span></div>
         </div>`,
      );
      const handles = topDocument.querySelectorAll('.polarion-rpe-expandTools');
      const staleClicked = vi.fn();
      const activeClicked = vi.fn();
      handles[0].addEventListener('click', staleClicked);
      handles[1].addEventListener('click', activeClicked);

      engine().autoExpandRichPageTools();
      expect(staleClicked).not.toHaveBeenCalled();
      expect(activeClicked).toHaveBeenCalledTimes(1);
    });

    it('is idempotent, repeated calls keep a single shared observer', () => {
      setHtml('');
      engine().autoExpandRichPageTools();
      const observer = topWindow.__genericRpeAutoExpandObserver;
      engine().autoExpandRichPageTools();
      expect(topWindow.__genericRpeAutoExpandObserver).toBe(observer);
    });

    it('coalesces mutations across observer callbacks into a single expand check', async () => {
      setHtml('');
      engine().autoExpandRichPageTools();

      // Two mutation bursts in separate observer callbacks, before the queued frame runs: the second
      // callback must early-return on the `scheduled` guard rather than queue a second frame.
      host.appendChild(topDocument.createElement('span'));
      await flushObserver(); // callback 1 schedules one frame
      host.appendChild(topDocument.createElement('span'));
      await flushObserver(); // callback 2 sees `scheduled` and returns
      expect(rafCallbacks).toHaveLength(1);
    });

    it('defers until the body exists when invoked from a head injection', () => {
      // Simulate a script running before <body> is parsed: body is momentarily absent.
      const realBody = topDocument.body;
      Object.defineProperty(topDocument, 'body', { configurable: true, get: () => null });
      try {
        engine().autoExpandRichPageTools();
      } finally {
        Object.defineProperty(topDocument, 'body', { configurable: true, get: () => realBody });
      }
      // The observer is not observing yet; it starts on the shell document's DOMContentLoaded (the
      // engine listens on top.document, the same document whose body it waits for).
      setHtml(rpeHtml({ toolbar: false, expandHandle: true }));
      const clicked = vi.fn();
      topDocument.querySelector('.polarion-rpe-expandTools')!.addEventListener('click', clicked);
      topDocument.dispatchEvent(new Event('DOMContentLoaded'));
      expect(clicked).toHaveBeenCalledTimes(1);
    });
  });

  describe('addButton', () => {
    const BUTTON = {
      marker: 'pdf-exporter',
      title: 'Export to PDF',
      iconUrl: '/polarion/ria/images/dle/operations/actionPdfExport16.svg',
      onClick: "alert('go')",
    };
    const injected = () => byId('pdf-exporter-toolbar-injected');

    afterEach(() => {
      window.location.hash = '';
    });

    it('builds the standard button and injects it in one call', () => {
      setHtml(dleHtml());
      engine().addButton(BUTTON);

      const cell = injected()!;
      expect(cell).not.toBeNull();
      expect(cell.tagName).toBe('TD');
      // Polarion's own group separator precedes the button.
      expect(cell.querySelector('img.polarion-dle-ToolbarPanel-separator')).not.toBeNull();
      const button = cell.querySelector<HTMLElement>('.dleToolBarSingleButton')!;
      expect(button.getAttribute('onclick')).toBe("alert('go')");
      expect(button.getAttribute('role')).toBe('button');
      const icon = cell.querySelector('img.polarion-MenuButton-Icon')!;
      expect(icon.getAttribute('src')).toBe(BUTTON.iconUrl);
      expect(icon.getAttribute('alt')).toBe('Export to PDF');
      expect(cell.querySelector('.dleToolBarTableCell')!.getAttribute('title')).toBe('Export to PDF');
    });

    it('derives the marker id from the extension context, which is what ordering keys off', () => {
      setHtml(dleHtml());
      addInjectScripts('docx-exporter', 'pdf-exporter');
      engine().addButton(BUTTON);
      engine().addButton({ ...BUTTON, marker: 'docx-exporter' });

      expect(injectedIds()).toEqual(['docx-exporter-toolbar-injected', 'pdf-exporter-toolbar-injected']);
    });

    it('escapes the title and icon so a stray quote cannot break out of its attribute', () => {
      setHtml(dleHtml());
      engine().addButton({ ...BUTTON, title: 'He said "go" & <left>' });

      const cell = injected()!;
      expect(cell.querySelector('.dleToolBarTableCell')!.getAttribute('title')).toBe('He said "go" & <left>');
      // The quote did not spawn extra attributes or elements.
      expect(cell.querySelectorAll('.dleToolBarSingleButton')).toHaveLength(1);
    });

    it('scopes the permission check to the current project', async () => {
      setHtml(dleHtml());
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ permitted: true }) });
      vi.stubGlobal('fetch', fetchMock);
      window.location.hash = '#/project/elibrary/wiki/Page';

      engine().addButton({ ...BUTTON, permissionUrl: '/polarion/pdf-exporter/rest/internal/permissions/export' });
      await flushPromises();

      expect(fetchMock.mock.calls[0][0]).toBe(
        '/polarion/pdf-exporter/rest/internal/permissions/export?projectId=elibrary',
      );
    });

    it('omits the project when the hash segment is not a valid project id', async () => {
      setHtml(dleHtml());
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ permitted: true }) });
      vi.stubGlobal('fetch', fetchMock);
      // The hash is user-controlled: a crafted segment must not reach the request URL.
      window.location.hash = '#/project/evil%20id?x=1/wiki/Page';

      engine().addButton({ ...BUTTON, permissionUrl: '/perm' });
      await flushPromises();

      expect(fetchMock.mock.calls[0][0]).toBe('/perm');
    });

    it('omits the project when the URL carries no project scope', async () => {
      setHtml(dleHtml());
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ permitted: true }) });
      vi.stubGlobal('fetch', fetchMock);

      engine().addButton({ ...BUTTON, permissionUrl: '/perm' });
      await flushPromises();

      expect(fetchMock.mock.calls[0][0]).toBe('/perm');
    });

    it('injects disabled while the permission check is pending, then enables it', async () => {
      setHtml(dleHtml());
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ permitted: true }) }));

      engine().addButton({ ...BUTTON, permissionUrl: '/perm' });
      expect(injected()!.classList.contains('dleToolBarDisabled')).toBe(true);
      await flushPromises();
      expect(injected()!.classList.contains('dleToolBarDisabled')).toBe(false);
    });

    it('needs no permission check, and then injects enabled straight away', () => {
      setHtml(dleHtml());
      engine().addButton(BUTTON);
      expect(injected()!.classList.contains('dleToolBarDisabled')).toBe(false);
    });

    it('self-heals after a toolbar re-render, like create() does', async () => {
      setHtml(dleHtml());
      engine().addButton(BUTTON);

      injected()!.remove();
      topDocument.querySelector('div.polarion-dle-Container')!.appendChild(topDocument.createElement('span'));
      await flushObserver();
      rafCallbacks.forEach((callback) => callback(0));

      expect(injected()).not.toBeNull();
    });
  });

  describe('style and script injection helpers', () => {
    it('injectOwnStyles injects the bundled toolbar styles as a <style> in the top frame', () => {
      engine().injectOwnStyles();

      const style = topDocument.getElementById('generic-dle-toolbar-styles')!;
      expect(style).not.toBeNull();
      expect(style.tagName).toBe('STYLE');
      // The CSS is bundled into the script, so nothing is fetched and no URL is derived.
      expect(style.textContent).toContain('.dleToolBarSingleButton');
      expect(style.textContent).toContain('.dleToolBarDisabled');
      // The floating above-the-editor container is gone along with that placement mode.
      expect(style.textContent).not.toContain('.dleToolBarContainer');
    });

    it('injectOwnStyles is idempotent', () => {
      engine().injectOwnStyles();
      engine().injectOwnStyles();
      expect(topDocument.querySelectorAll('#generic-dle-toolbar-styles')).toHaveLength(1);
    });

    it('injectStyles adds a stylesheet link once and injectScript adds a script once', () => {
      engine().injectStyles('sbb-css', '/x.css');
      engine().injectStyles('sbb-css', '/x.css'); // idempotent
      const link = topDocument.getElementById('sbb-css') as HTMLLinkElement;
      expect(link.tagName).toBe('LINK');
      expect(link.rel).toBe('stylesheet');
      expect(link.href).toContain('/x.css');
      expect(topDocument.querySelectorAll('#sbb-css')).toHaveLength(1);

      engine().injectScript('sbb-js', '/x.js');
      engine().injectScript('sbb-js', '/x.js'); // idempotent
      const script = topDocument.getElementById('sbb-js')!;
      expect(script.tagName).toBe('SCRIPT');
      expect(script.getAttribute('type')).toBe('text/javascript'); // default type
      expect(script.getAttribute('src')).toBe('/x.js');
      expect(topDocument.querySelectorAll('#sbb-js')).toHaveLength(1);
    });
  });
});
