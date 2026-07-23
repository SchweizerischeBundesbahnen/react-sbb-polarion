import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SearchableDropdown from '../src/generic/SearchableDropdown.js';
import { mousedown } from './helpers';

// NEW tests with no counterpart in generic - they guard RSP's local patches to the vendored
// SearchableDropdown.js (see CLAUDE.md "Vendored generic code"): the option-list portal must follow the
// control into a shadow root (getRootNode, for the form-extension panels), and outside-click detection
// must use event.composedPath() so it works across the shadow boundary. If a future re-copy from generic
// drops these patches, these tests fail.

let fixture: HTMLDivElement;

beforeEach(() => {
  fixture = document.createElement('div');
  document.body.appendChild(fixture);
});

afterEach(() => {
  fixture.remove();
  document.querySelectorAll('.sd-portal').forEach((el) => el.remove());
});

// A host with an open shadow root containing a .sbb-ui wrapper, a <select>, and an unrelated element.
const shadowHost = () => {
  const host = document.createElement('div');
  fixture.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  const wrap = document.createElement('div');
  wrap.className = 'sbb-ui';
  wrap.innerHTML =
    '<select><option value="a">A</option><option value="b">B</option></select><div id="elsewhere">outside</div>';
  root.appendChild(wrap);
  return { host, root, select: root.querySelector('select') as HTMLSelectElement };
};

describe('SearchableDropdown - shadow-DOM patches (RSP-specific)', () => {
  it('appends the option-list portal into the shadow root, not document.body', () => {
    const { root, select } = shadowHost();
    const dd = new SearchableDropdown({ element: select, rememberSelection: false });
    expect(root.querySelector('.sd-portal')).not.toBeNull(); // portal followed the control into the shadow
    expect(document.body.querySelector('.sd-portal')).toBeNull(); // and did not escape into the light DOM
    dd.destroy();
  });

  it('closes on an outside mousedown across the shadow boundary (composedPath)', () => {
    const { root, select } = shadowHost();
    const dd = new SearchableDropdown({ element: select, rememberSelection: false });
    mousedown(dd.trigger);
    expect(dd.isOpen).toBe(true);
    mousedown(root.querySelector('#elsewhere')!); // inside the shadow, outside the dropdown
    expect(dd.isOpen).toBe(false);
    dd.destroy();
  });

  it('stays open on a mousedown inside the (shadow) portal', () => {
    const { select } = shadowHost();
    const dd = new SearchableDropdown({ element: select, rememberSelection: false });
    mousedown(dd.trigger);
    mousedown(dd.portal);
    expect(dd.isOpen).toBe(true);
    dd.destroy();
  });
});
