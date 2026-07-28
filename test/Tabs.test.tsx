import { flushSync } from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Tabs from '../src/components/Tabs';
import type { TabItem } from '../src/components/Tabs';

// Behavior tests for the shared tab bar (screenshot-free, so they run on Windows and Docker alike).
// Appearance - the active tab merging into the panel below - is covered in Tabs.visual.test.tsx.
// Rendered via createRoot + flushSync (synchronous component), matching the ConfigurationButtons tests.

const ITEMS: TabItem[] = [
  { id: 'first', label: 'First' },
  { id: 'second', label: 'Second' },
  { id: 'third', label: 'Third' },
];

const tabs = () => Array.from(document.querySelectorAll<HTMLLIElement>('.tabs .tab'));
const radios = () => Array.from(document.querySelectorAll<HTMLInputElement>('.tabs input[type="radio"]'));
const labels = () => tabs().map((t) => (t.textContent ?? '').trim());
const activeLabels = () =>
  tabs()
    .filter((t) => t.classList.contains('active'))
    .map((t) => (t.textContent ?? '').trim());

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function teardown() {
  if (root) {
    flushSync(() => root!.unmount());
    root = undefined;
  }
  container?.remove();
  container = undefined;
}

afterEach(teardown);

function renderTabs(
  overrides: { items?: TabItem[]; activeId?: string; onSelect?: (id: string) => void; name?: string } = {},
) {
  teardown();
  const onSelect = overrides.onSelect ?? vi.fn();
  container = document.createElement('div');
  container.className = 'sbb-ui';
  document.body.appendChild(container);
  root = createRoot(container);
  flushSync(() => {
    root!.render(
      <Tabs
        items={overrides.items ?? ITEMS}
        activeId={'activeId' in overrides ? overrides.activeId : 'second'}
        onSelect={onSelect}
        name={overrides.name}
        ariaLabel="Hooks"
      />,
    );
  });
  return { onSelect };
}

describe('Tabs', () => {
  it('renders one tab per item, in order, with the generic tab-bar markup', () => {
    renderTabs();
    expect(labels()).toEqual(['First', 'Second', 'Third']);
    expect(document.querySelector('.tabs')?.getAttribute('aria-label')).toBe('Hooks');
    // The stylesheet targets .tab > label, and the radio must live inside it.
    expect(tabs().every((t) => t.querySelector(':scope > label > input[type="radio"]') !== null)).toBe(true);
  });

  it('marks exactly the active tab, on the li the stylesheet styles', () => {
    renderTabs({ activeId: 'third' });
    expect(activeLabels()).toEqual(['Third']);
    expect(radios().map((r) => r.checked)).toEqual([false, false, true]);
  });

  it('reports the picked tab rather than selecting it itself', () => {
    // Controlled: clicking does not move the active tab until the caller changes activeId back in.
    const { onSelect } = renderTabs({ activeId: 'first' });
    radios()[2].click();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('third');
    expect(activeLabels()).toEqual(['First']);
  });

  it('follows activeId when the caller moves it', () => {
    renderTabs({ activeId: 'first' });
    expect(activeLabels()).toEqual(['First']);
    flushSync(() => {
      root!.render(<Tabs items={ITEMS} activeId="second" onSelect={vi.fn()} />);
    });
    expect(activeLabels()).toEqual(['Second']);
  });

  it('activates nothing when activeId matches no tab', () => {
    // The hooks page starts here: the bar renders before the first hook has been chosen.
    renderTabs({ activeId: undefined });
    expect(activeLabels()).toEqual([]);
    expect(radios().some((r) => r.checked)).toBe(false);
  });

  it('groups its radios under one name so a click cannot select two tabs', () => {
    renderTabs({ name: 'hook-name' });
    expect(radios().map((r) => r.name)).toEqual(['hook-name', 'hook-name', 'hook-name']);
  });

  it('defaults to a name of its own, so two bars on a page do not clear each other', () => {
    renderTabs();
    const first = radios()[0].name;
    expect(first).toBeTruthy();
    expect(radios().every((r) => r.name === first)).toBe(true);

    const other = document.createElement('div');
    document.body.appendChild(other);
    const otherRoot = createRoot(other);
    flushSync(() => {
      otherRoot.render(<Tabs items={ITEMS} activeId="first" onSelect={vi.fn()} />);
    });
    const otherName = other.querySelector<HTMLInputElement>('input[type="radio"]')!.name;
    expect(otherName).not.toBe(first);

    flushSync(() => otherRoot.unmount());
    other.remove();
  });

  it('renders an empty bar for an empty list rather than failing', () => {
    renderTabs({ items: [] });
    expect(document.querySelector('.tabs')).not.toBeNull();
    expect(tabs()).toHaveLength(0);
  });
});
