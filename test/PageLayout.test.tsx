import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import PageLayout from '../src/components/PageLayout';

// PageLayout shows the body always, the title only when the `title` prop is given, and the "← Overview"
// back link only when NOT embedded (isEmbedded/getScope read window.location.search). Drive the URL with
// history.replaceState.

const origUrl = window.location.pathname + window.location.search;
const setSearch = (search: string) => window.history.replaceState({}, '', search || window.location.pathname);

const q = <T extends Element>(sel: string): T | null => document.querySelector<T>(sel);

// render() from vitest-browser-react commits asynchronously, so wait for the page frame before asserting.
async function mount(ui: Parameters<typeof render>[0]) {
  render(ui);
  await vi.waitFor(() => expect(q('.page')).not.toBeNull());
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', origUrl);
});

describe('PageLayout', () => {
  it('renders the title and the children in the page body', async () => {
    setSearch('');
    await mount(
      <PageLayout title="Mappings">
        <p data-testid="child">hello</p>
      </PageLayout>,
    );
    expect(q('.page h1')?.textContent).toBe('Mappings');
    expect(q('.page-body [data-testid="child"]')).not.toBeNull();
  });

  it('shows the Overview back link when not embedded (href "?" with no scope)', async () => {
    setSearch('');
    await mount(<PageLayout title="X">body</PageLayout>);
    const link = q<HTMLAnchorElement>('.page-nav a');
    expect(link).not.toBeNull();
    expect(link!.textContent).toContain('Overview');
    expect(link!.getAttribute('href')).toBe('?');
  });

  it('carries the current scope back into the Overview link', async () => {
    setSearch('?scope=project/elibrary');
    await mount(<PageLayout title="X">body</PageLayout>);
    expect(q<HTMLAnchorElement>('.page-nav a')!.getAttribute('href')).toBe('?scope=project%2Felibrary%2F');
  });

  it('hides the Overview link when embedded=true', async () => {
    setSearch('?embedded=true');
    await mount(<PageLayout title="X">body</PageLayout>);
    expect(q('.page-nav')).toBeNull();
    // Title and body still render in embedded mode.
    expect(q('.page h1')?.textContent).toBe('X');
  });

  it('renders no heading when the title is omitted (product surface), but still shows the body and link', async () => {
    setSearch('');
    await mount(
      <PageLayout>
        <p data-testid="child">hello</p>
      </PageLayout>,
    );
    expect(q('.page h1')).toBeNull();
    expect(q('.page-body [data-testid="child"]')).not.toBeNull();
    expect(q('.page-nav a')?.textContent).toContain('Overview');
  });
});
