import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import UserGuide from '../src/components/UserGuide';
import type { SendRequest } from '../src/types';

// Visual-regression states for the shared User Guide page. Kept separate from the behavior tests
// (Docker-only, since any toMatchScreenshot file diffs on non-Linux font antialiasing). References live
// in test/expected/UserGuide/ and MUST be generated in Docker (npm run test:update:docker).
//
// What this page contributes on top of the raw help HTML is the bundled markdown.css heading look, so
// the fixture is heading-led. It deliberately carries no <pre>/<code>: the monospace styling for those
// comes from the github-markdown-light.css that the consuming app links, which RSP does not own and
// does not load here - screenshotting it would pin someone else's stylesheet through the browser's
// non-deterministic generic `monospace` pick.

const GUIDE =
  '<h1>User Guide</h1>' +
  '<p>How to configure the importer for a project.</p>' +
  '<h2>Creating a mapping</h2>' +
  '<p>Open the administration page and pick <strong>Add new</strong>.</p>' +
  '<ul><li>Name the mapping</li><li>Select the work item type</li><li>Save</li></ul>' +
  '<h3>Notes</h3>' +
  '<p>Mappings are inherited from the global scope unless the project defines its own.</p>';

let container: HTMLDivElement | undefined;

function mount(sendRequest: SendRequest) {
  container = document.createElement('div');
  container.className = 'sbb-ui standard-admin-page';
  container.style.width = '860px';
  container.style.background = '#fff';
  document.body.appendChild(container);
  render(<UserGuide sendRequest={sendRequest} />, { container });
}

const shot = (name: string) => expect(page.elementLocator(container as HTMLElement)).toMatchScreenshot(name);

afterEach(() => {
  cleanup();
  container?.remove();
  container = undefined;
});

describe.skipIf(!__PIXEL_REFERENCES__)('UserGuide visual states', () => {
  it('rendered help article with the bundled markdown headings', async () => {
    mount(async () => new Response(GUIDE, { status: 200 }));
    await vi.waitFor(() => expect(document.querySelector('article.user-guide-page')).not.toBeNull());
    await shot('user-guide-article');
  });

  it('error banner when the guide cannot be fetched', async () => {
    mount(async () => new Response('', { status: 404 }));
    await vi.waitFor(() => expect(document.querySelector('.alert-error')).not.toBeNull());
    await shot('user-guide-error');
  });

  it('loading placeholder before the guide arrives', async () => {
    mount(() => new Promise<Response>(() => {}));
    await vi.waitFor(() => expect(document.body.textContent).toContain('Loading...'));
    await shot('user-guide-loading');
  });
});
