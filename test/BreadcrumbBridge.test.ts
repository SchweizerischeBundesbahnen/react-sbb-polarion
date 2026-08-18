import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// The bridge is a classic (non-module) script that self-registers on the window it runs in; importing
// it for its side effect exposes window.SbbBreadcrumbBridge.install to the tests. In this ES import
// there is no document.currentScript, so its data-* auto-install path stays dormant and each test
// drives install() directly.
import '../src/shell/BreadcrumbBridge.js';
import type { BreadcrumbBridgeConfig, BreadcrumbBridgeHandle } from '../src/shell/BreadcrumbBridge.js';

// These run against the runner's own real page rather than a fresh JSDOM per case, so activation is
// driven through location.hash instead of a per-test URL. The marker must not appear anywhere in the
// runner's URL, or isAppUrl() would report every test as active: "xml-repair" does not.
const MARKER = 'xml-repair';
const ORIGINAL_CLASS = 'polarion-ApplicationHeader-breadcrumb';
const CONFIG: BreadcrumbBridgeConfig = {
  marker: MARKER,
  title: 'XML-Repair',
  icon: '/polarion/xml-repair-admin/icon.svg',
};
const STYLE_ID = `sbb-breadcrumb-style-${MARKER}`;
const CUSTOM_ID = `sbb-breadcrumb-${MARKER}`;
const APP_HASH = `#/${MARKER}/scan`;

const install = (config: BreadcrumbBridgeConfig) => window.SbbBreadcrumbBridge!.install(config);
const styleTag = () => document.getElementById(STYLE_ID);
const customEl = () => document.getElementById(CUSTOM_ID);
const titlesOf = (el: HTMLElement) => el.querySelectorAll(`.${ORIGINAL_CLASS}Title`);

let handle: BreadcrumbBridgeHandle | null = null;
let originals: HTMLElement[] = [];

function addOriginal() {
  const original = document.createElement('div');
  original.className = ORIGINAL_CLASS;
  original.textContent = 'Polarion';
  document.body.appendChild(original);
  originals.push(original);
  return original;
}

/** Navigate within the page and run the bridge's hashchange handler synchronously. */
function goTo(hash: string) {
  window.location.hash = hash;
  window.dispatchEvent(new Event('hashchange'));
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  // Destroy first: it disconnects the observer and the hash listeners, so resetting the URL afterwards
  // cannot make a torn-down instance re-sync.
  handle?.destroy();
  handle = null;
  originals.forEach((el) => el.remove());
  originals = [];
  window.location.hash = '';
});

describe('BreadcrumbBridge', () => {
  it('does nothing without a marker or title', () => {
    goTo(APP_HASH);
    expect(install({} as BreadcrumbBridgeConfig)).toBeNull();
    expect(install({ marker: MARKER } as BreadcrumbBridgeConfig)).toBeNull();
    expect(install({ title: 'X' } as BreadcrumbBridgeConfig)).toBeNull();
  });

  it('hides the GWT breadcrumb via a stylesheet rule and mounts its own while active', () => {
    goTo(APP_HASH);
    const original = addOriginal();
    handle = install(CONFIG);

    // The real breadcrumb is hidden by a !important rule (survives GWT resetting its inline style),
    // not by touching the element itself.
    expect(styleTag()).not.toBeNull();
    expect(styleTag()!.textContent).toContain(':not([data-sbb-bridge])');
    expect(styleTag()!.textContent).toContain('display:none !important');
    expect(original.style.display).toBe(''); // we never touch the GWT element's inline style

    const custom = customEl()!;
    expect(custom).not.toBeNull();
    expect(custom.previousElementSibling).toBe(original);
    expect(custom.style.display).not.toBe('none');

    const titleEl = custom.querySelector<HTMLElement>(`.${ORIGINAL_CLASS}Title`)!;
    expect(titleEl.textContent).toBe('XML-Repair');
    expect(titleEl.title).toBe('XML-Repair');
    expect(custom.querySelector('img')!.getAttribute('src')).toBe('/polarion/xml-repair-admin/icon.svg');
    // The built breadcrumb carries data-sbb-bridge so the hide rule never matches it.
    expect(custom.querySelector('[data-sbb-bridge]')).not.toBeNull();
  });

  it('does not hide anything when the app URL is not active', () => {
    goTo('#/some-other-app');
    addOriginal();
    handle = install(CONFIG);

    expect(styleTag()).toBeNull();
    expect(customEl()).toBeNull();
  });

  it('omits the icon when none is configured', () => {
    goTo(APP_HASH);
    addOriginal();
    handle = install({ marker: MARKER, title: 'XML-Repair' });

    const custom = customEl()!;
    expect(custom.querySelector('img')).toBeNull();
    expect(custom.querySelector(`.${ORIGINAL_CLASS}Title`)!.textContent).toBe('XML-Repair');
  });

  it('is idempotent per marker (re-install returns the same handle)', () => {
    goTo(APP_HASH);
    addOriginal();
    handle = install(CONFIG);
    expect(install(CONFIG)).toBe(handle);
  });

  it('starts hiding immediately and mounts once a late GWT breadcrumb appears', async () => {
    goTo(APP_HASH);
    handle = install(CONFIG);
    // Hiding rule is applied even before GWT renders (no flash); the custom waits for an anchor.
    expect(styleTag()).not.toBeNull();
    expect(customEl()).toBeNull();

    addOriginal();

    await vi.waitFor(() => expect(customEl()).not.toBeNull());
    expect(customEl()!.querySelector(`.${ORIGINAL_CLASS}Title`)!.textContent).toBe('XML-Repair');
  });

  it('re-syncs on hashchange', () => {
    addOriginal();
    handle = install(CONFIG); // no marker in the URL yet
    expect(styleTag()).toBeNull();

    goTo(APP_HASH);

    expect(styleTag()).not.toBeNull();
    expect(customEl()!.style.display).not.toBe('none');
  });

  it('copies the original breadcrumb flex order onto its replacement', () => {
    goTo(APP_HASH);
    const original = addOriginal();
    original.style.order = '2'; // sit the replacement in the same flex slot
    handle = install(CONFIG);
    expect(customEl()!.style.order).toBe('2');
  });

  it('hides its replacement when navigating away from the app page', () => {
    goTo(APP_HASH);
    addOriginal();
    handle = install(CONFIG);
    expect(customEl()!.style.display).not.toBe('none'); // mounted on the app page

    goTo('#/other-page'); // marker no longer in the URL

    expect(customEl()!.style.display).toBe('none');
  });

  it('keeps hiding across a GWT re-render (observer stays connected)', async () => {
    goTo(APP_HASH);
    const original = addOriginal();
    handle = install(CONFIG);
    expect(styleTag()).not.toBeNull();

    // GWT re-render: the old node is replaced by a fresh one. The stylesheet rule keeps hiding any
    // real breadcrumb regardless, and the custom stays mounted.
    original.remove();
    addOriginal();

    await vi.waitFor(() => expect(customEl()).not.toBeNull());
    expect(styleTag()).not.toBeNull();
    expect(customEl()!.style.display).not.toBe('none');
  });

  it('never mistakes its own built breadcrumb for the GWT element', () => {
    goTo(APP_HASH);
    const original = addOriginal();
    handle = install(CONFIG);
    expect(customEl()!.querySelector(`.${ORIGINAL_CLASS}Title`)!.textContent).toBe('XML-Repair');

    // GWT momentarily removes its node; a sync fires meanwhile. The built breadcrumb carries the same
    // class but is excluded via [data-sbb-bridge], so findOriginal() returns null and the custom
    // breadcrumb is left intact.
    original.remove();
    handle!.sync();

    expect(styleTag()).not.toBeNull();
    expect(customEl()!.style.display).not.toBe('none');
    expect(customEl()!.querySelector(`.${ORIGINAL_CLASS}Title`)).not.toBeNull();
  });

  it('does not activate on Polarion Administration pages', () => {
    // The admin URL is `#/administration/<ext>/...`, which also contains the marker. Polarion renders
    // the correct breadcrumb there, so the bridge must stay out.
    goTo(`#/administration/${MARKER}/settings`);
    addOriginal();
    handle = install(CONFIG);

    expect(styleTag()).toBeNull();
    expect(customEl()).toBeNull();
  });

  it('renders a sub-topic as "parent > small-icon title"', () => {
    goTo(`#/project/x/${MARKER}/details`);
    addOriginal();
    handle = install({ marker: MARKER, title: 'Details', parent: 'XML-Repair', icon: '/i.svg' });

    const custom = customEl()!;
    const titles = titlesOf(custom);
    expect(titles).toHaveLength(2);
    expect(titles[0].textContent).toBe('XML-Repair'); // parent segment
    expect(titles[1].textContent).toBe('Details'); // current topic
    expect(custom.querySelector(`.${ORIGINAL_CLASS}Separator`)).not.toBeNull();
    expect(custom.querySelector('img')!.style.width).toBe('17px'); // small sub icon
  });

  it('root topics use the large icon and no parent segment', () => {
    goTo(APP_HASH);
    addOriginal();
    handle = install(CONFIG);

    const custom = customEl()!;
    expect(titlesOf(custom)).toHaveLength(1);
    expect(custom.querySelector(`.${ORIGINAL_CLASS}Separator`)).toBeNull();
    expect(custom.querySelector('img')!.style.width).toBe('30px');
  });

  it('re-installing with the same marker re-labels (sub-topic switch) and reuses the instance', () => {
    goTo(APP_HASH);
    addOriginal();
    handle = install({ marker: MARKER, title: 'Root', icon: '/i.svg' });
    expect(titlesOf(customEl()!)).toHaveLength(1);
    expect(titlesOf(customEl()!)[0].textContent).toBe('Root');

    const same = install({ marker: MARKER, title: 'Child', parent: 'Root', icon: '/i.svg' });
    expect(same).toBe(handle); // same instance, updated in place

    const titles = titlesOf(customEl()!);
    expect(titles).toHaveLength(2);
    expect(titles[0].textContent).toBe('Root'); // parent
    expect(titles[1].textContent).toBe('Child'); // new current topic
  });

  it('destroy() restores the GWT breadcrumb and lets a fresh install run again', () => {
    goTo(APP_HASH);
    addOriginal();
    const first = install(CONFIG)!;
    expect(styleTag()).not.toBeNull();
    expect(customEl()).not.toBeNull();

    first.destroy();
    // Hiding rule gone (GWT breadcrumb visible again) and our element removed, so no blank slot.
    expect(styleTag()).toBeNull();
    expect(customEl()).toBeNull();

    handle = install(CONFIG);
    expect(handle).not.toBe(first);
    expect(styleTag()).not.toBeNull();
    expect(customEl()).not.toBeNull();
  });
});
