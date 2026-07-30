import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import StylePackageWeights, {
  type WeightEntry,
  computeWeightForPosition,
  normalizeWeight,
  placeAt,
  sortEntries,
} from '../src/components/StylePackageWeights';
import Toaster from '../src/components/Toaster';
import type { StylePackageWeight, StylePackageWeightsService } from '../src/services/stylePackageWeights';

// The exporters' style-package ordering page. The weight arithmetic is the part worth pinning down: it
// decides both the stored numbers and which package the export panel preselects, and it came over from
// a vanilla class whose behavior the migrated page has to keep.

/** An entry, with the fields the arithmetic reads; `preferredWeight` defaults to the current weight. */
const entry = (name: string, weight: number, extra: Partial<WeightEntry> = {}): WeightEntry => ({
  name,
  scope: '',
  weight,
  preferredWeight: weight,
  readOnly: false,
  ...extra,
});

const names = (entries: WeightEntry[]): string[] => entries.map((e) => e.name);

describe('sortEntries', () => {
  it('puts the heaviest first, since the top entry is the preselected one', () => {
    expect(names(sortEntries([entry('light', 10), entry('heavy', 90), entry('middle', 50)]))).toEqual([
      'heavy',
      'middle',
      'light',
    ]);
  });

  it('breaks a tie alphabetically, so equal weights still have one predictable order', () => {
    expect(names(sortEntries([entry('b', 50), entry('c', 50), entry('a', 50)]))).toEqual(['a', 'b', 'c']);
  });

  it('leaves the input array untouched', () => {
    const input = [entry('light', 10), entry('heavy', 90)];
    sortEntries(input);
    expect(names(input)).toEqual(['light', 'heavy']);
  });
});

describe('computeWeightForPosition', () => {
  it('leaves a lone entry with the weight it has', () => {
    expect(computeWeightForPosition([entry('only', 42)], 0)).toBe(42);
  });

  it('keeps the preferred weight at the top when it still outweighs the next entry', () => {
    const entries = [entry('moved', 80, { preferredWeight: 80 }), entry('other', 50)];
    expect(computeWeightForPosition(entries, 0)).toBe(80);
  });

  it('lifts an entry one above the next when its preferred weight would not hold the top', () => {
    const entries = [entry('moved', 10, { preferredWeight: 10 }), entry('other', 50)];
    expect(computeWeightForPosition(entries, 0)).toBe(51);
  });

  it('keeps the preferred weight at the bottom when it is still under the entry above', () => {
    const entries = [entry('other', 50), entry('moved', 20, { preferredWeight: 20 })];
    expect(computeWeightForPosition(entries, 1)).toBe(20);
  });

  it('drops an entry one below the previous when its preferred weight would not hold the bottom', () => {
    const entries = [entry('other', 50), entry('moved', 90, { preferredWeight: 90 })];
    expect(computeWeightForPosition(entries, 1)).toBe(49);
  });

  it('keeps a preferred weight that already falls between the new neighbours', () => {
    const entries = [entry('top', 80), entry('moved', 60, { preferredWeight: 60 }), entry('bottom', 40)];
    expect(computeWeightForPosition(entries, 1)).toBe(60);
  });

  it('halves the gap when the preferred weight does not fit between the neighbours', () => {
    const entries = [entry('top', 80), entry('moved', 5, { preferredWeight: 5 }), entry('bottom', 40)];
    expect(computeWeightForPosition(entries, 1)).toBe(60);
  });

  it('rounds a halved gap to one decimal, the granularity the field accepts', () => {
    const entries = [entry('top', 1), entry('moved', 90, { preferredWeight: 90 }), entry('bottom', 0)];
    expect(computeWeightForPosition(entries, 1)).toBe(0.5);
  });

  it('clamps to the top of the range rather than stepping past it', () => {
    const entries = [entry('moved', 0, { preferredWeight: 0 }), entry('other', 100)];
    expect(computeWeightForPosition(entries, 0)).toBe(100);
  });

  it('clamps to the bottom of the range rather than going negative', () => {
    const entries = [entry('other', 0), entry('moved', 50, { preferredWeight: 50 })];
    expect(computeWeightForPosition(entries, 1)).toBe(0);
  });
});

describe('placeAt', () => {
  const list = () => [entry('a', 90), entry('b', 50), entry('c', 10)];

  it('reports no change when an entry is dropped on its own top edge', () => {
    expect(placeAt(list(), 1, 1)).toBeNull();
  });

  it('reports no change when an entry is dropped on its own bottom edge', () => {
    expect(placeAt(list(), 1, 2)).toBeNull();
  });

  it('refuses to move a read-only entry', () => {
    const entries = [entry('global', 90, { readOnly: true }), entry('own', 50)];
    expect(placeAt(entries, 0, 2)).toBeNull();
  });

  it('reports no change for an index that is not in the list', () => {
    expect(placeAt(list(), 9, 0)).toBeNull();
  });

  it('moves an entry up and reweighs it to hold that slot', () => {
    const moved = placeAt(list(), 2, 0);
    expect(names(moved!)).toEqual(['c', 'a', 'b']);
    // Above 'a' (90) now, and its own 10 will not do.
    expect(moved![0].weight).toBe(91);
  });

  it('moves an entry down, accounting for the slot that closes behind it', () => {
    const moved = placeAt(list(), 0, 3);
    expect(names(moved!)).toEqual(['b', 'c', 'a']);
    expect(moved![2].weight).toBe(9);
  });

  it('places an entry between two others by halving their gap', () => {
    const moved = placeAt([entry('a', 90), entry('b', 50), entry('c', 10)], 0, 3);
    expect(moved![2].weight).toBe(9);
    const middle = placeAt([entry('a', 90), entry('b', 50), entry('c', 10)], 2, 1);
    expect(names(middle!)).toEqual(['a', 'c', 'b']);
    expect(middle![1].weight).toBe(70);
  });

  it('moves an entry across a read-only one, which stays where it is', () => {
    const entries = [entry('own-top', 90), entry('global', 50, { readOnly: true }), entry('own-bottom', 10)];
    const moved = placeAt(entries, 0, 3);

    expect(names(moved!)).toEqual(['global', 'own-bottom', 'own-top']);
    expect(moved![0].readOnly).toBe(true);
    expect(moved![2].weight).toBe(9);
  });

  it('clamps an insert position past the end onto the last slot', () => {
    const moved = placeAt(list(), 0, 99);
    expect(names(moved!)).toEqual(['b', 'c', 'a']);
  });

  it('leaves the input array and its entries untouched', () => {
    const input = list();
    placeAt(input, 2, 0);
    expect(names(input)).toEqual(['a', 'b', 'c']);
    expect(input[2].weight).toBe(10);
  });
});

describe('normalizeWeight', () => {
  it.each([
    ['an in-range integer', '70', 70],
    ['an in-range decimal', '12.3', 12.3],
    ['more decimals than the field accepts', '12.34', 12.3],
    ['a value over the maximum', '250', 100],
    ['a negative value', '-5', 0],
    ['the maximum itself', '100', 100],
    ['the minimum itself', '0', 0],
  ])('normalizes %s', (_name, raw, expected) => {
    expect(normalizeWeight(raw)).toBe(expected);
  });

  it.each([
    ['an empty field', ''],
    ['text', 'abc'],
  ])('falls back to the middle of the range for %s', (_name, raw) => {
    // Not to 0: a cleared field must not silently sink the package to the bottom of the list.
    expect(normalizeWeight(raw)).toBe(50);
  });

  it('accepts a number as readily as the text of one', () => {
    expect(normalizeWeight(12.34)).toBe(12.3);
  });
});

// ---------------------------------------------------------------------------------------------------

const GLOBAL_AND_OWN: StylePackageWeight[] = [
  { name: 'inherited', scope: '', weight: 60 },
  { name: 'compact', scope: 'project/elibrary/', weight: 90 },
  { name: 'verbose', scope: 'project/elibrary/', weight: 30 },
];

const origUrl = window.location.pathname + window.location.search;
const setScope = (scope: string) => window.history.replaceState({}, '', `?scope=${encodeURIComponent(scope)}`);

function makeService(overrides: Partial<StylePackageWeightsService> = {}): StylePackageWeightsService {
  return {
    loadWeights: () => Promise.resolve(GLOBAL_AND_OWN.map((w) => ({ ...w }))),
    saveWeights: () => Promise.resolve(),
    ...overrides,
  };
}

const rows = (): HTMLLIElement[] => Array.from(document.querySelectorAll<HTMLLIElement>('.weight-item'));
const rowNames = (): string[] => rows().map((li) => li.querySelector('.name')!.textContent ?? '');
const weightInput = (name: string): HTMLInputElement => {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label="Weight of ${name}"]`);
  if (!input) throw new Error(`weight input for "${name}" not found`);
  return input;
};
const iconButton = (label: string): HTMLButtonElement => {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`button "${label}" not found`);
  return button;
};
const toolbarButton = (label: string): HTMLButtonElement => {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.action-buttons .sbb-btn')).find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (!button) throw new Error(`toolbar button "${label}" not found`);
  return button;
};

/** Dispatches one drag event on a row, aimed at the given fraction of its height. */
function fireDrag(
  row: HTMLLIElement,
  type: 'dragstart' | 'dragover' | 'dragleave' | 'drop' | 'dragend',
  atFraction = 0.5,
) {
  const rect = row.getBoundingClientRect();
  row.dispatchEvent(
    new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      clientY: rect.top + rect.height * atFraction,
      dataTransfer: new DataTransfer(),
    }),
  );
}

/**
 * Lets React work through what a dispatched event queued. Needed before asserting that something did
 * NOT change: React schedules a default-priority update on a task, not a microtask, so an immediate
 * assertion sees the render that has not happened yet and passes no matter what the handler did.
 */
const settleRender = () => new Promise((resolve) => setTimeout(resolve, 0));

async function answerDialog(label: 'OK' | 'Cancel') {
  await vi.waitFor(() => expect(document.querySelector('.rsp-modal')).not.toBeNull());
  const target = Array.from(document.querySelectorAll<HTMLButtonElement>('.rsp-modal-footer .sbb-btn')).find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (!target) throw new Error(`dialog button "${label}" not found`);
  target.click();
}

async function mount(service = makeService()) {
  render(
    <>
      <Toaster />
      <StylePackageWeights title="PDF Exporter: Style Package Weights" service={service} />
    </>,
  );
  await vi.waitFor(() => expect(document.querySelector('.weights-list')).not.toBeNull());
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', origUrl);
});

describe('StylePackageWeights', () => {
  it('lists the packages heaviest first, which is the order of the export panel dropdown', async () => {
    setScope('project/elibrary/');
    await mount();

    expect(document.querySelector('h1')!.textContent).toBe('PDF Exporter: Style Package Weights');
    expect(rowNames()).toEqual(['compact', 'inherited', 'verbose']);
  });

  it('locks a globally defined package when a project scope is looking at it', async () => {
    setScope('project/elibrary/');
    await mount();

    const inherited = rows()[1];
    expect(inherited.classList.contains('static')).toBe(true);
    expect(inherited.getAttribute('draggable')).toBe('false');
    expect(inherited.querySelector('.lock-marker')).not.toBeNull();
    expect(inherited.querySelector('.drag-handle')).toBeNull();
    expect(weightInput('inherited').readOnly).toBe(true);
    // No reorder arrows and no spinner: nothing here is editable from this scope.
    expect(inherited.querySelector('.reorder-arrows.placeholder')).not.toBeNull();
    expect(inherited.querySelector('.sbb-number-spin')).toBeNull();
  });

  it('locks nothing in the global scope, where every package is administered', async () => {
    setScope('');
    await mount();

    expect(document.querySelectorAll('.weight-item.static')).toHaveLength(0);
    expect(document.querySelectorAll('.drag-handle')).toHaveLength(3);
    expect(weightInput('inherited').readOnly).toBe(false);
  });

  it('moves a package up with the caret button and reweighs it above its new neighbour', async () => {
    setScope('');
    await mount();

    iconButton('Move verbose up').click();

    await vi.waitFor(() => expect(rowNames()).toEqual(['compact', 'verbose', 'inherited']));
    // Between 90 and 60; its own 30 does not fit, so it lands in the middle of the gap.
    expect(weightInput('verbose').value).toBe('75');
  });

  it('moves a package down with the caret button', async () => {
    setScope('');
    await mount();

    iconButton('Move compact down').click();

    await vi.waitFor(() => expect(rowNames()).toEqual(['inherited', 'compact', 'verbose']));
    expect(weightInput('compact').value).toBe('45');
  });

  it('disables the caret that would move a package off the end of the list', async () => {
    setScope('');
    await mount();

    expect(iconButton('Move compact up').disabled).toBe(true);
    expect(iconButton('Move compact down').disabled).toBe(false);
    expect(iconButton('Move verbose up').disabled).toBe(false);
    expect(iconButton('Move verbose down').disabled).toBe(true);
  });

  it('leaves the list alone while a weight is being typed, and re-sorts once the field is left', async () => {
    setScope('');
    await mount();

    // Typed through the browser, not by assigning `.value`: React tracks the value it last saw, so an
    // assignment followed by a synthetic `input` event is swallowed - the draft would never be exercised
    // and the test would pass on the DOM value alone.
    await userEvent.fill(weightInput('verbose'), '9');

    // A "9" on the way to "95" must not reorder the list under the cursor.
    expect(rowNames()).toEqual(['compact', 'inherited', 'verbose']);
    expect(weightInput('verbose').value).toBe('9');

    await userEvent.fill(weightInput('verbose'), '95');
    expect(rowNames()).toEqual(['compact', 'inherited', 'verbose']);

    weightInput('verbose').blur();

    await vi.waitFor(() => expect(rowNames()).toEqual(['verbose', 'compact', 'inherited']));
    expect(weightInput('verbose').value).toBe('95');
  });

  it('commits a typed weight on Enter without waiting for the field to lose focus', async () => {
    setScope('');
    await mount();

    await userEvent.fill(weightInput('verbose'), '95');
    await userEvent.keyboard('{Enter}');

    await vi.waitFor(() => expect(rowNames()).toEqual(['verbose', 'compact', 'inherited']));
  });

  it('leaves a draft alone on any key that is not Enter', async () => {
    setScope('');
    await mount();

    await userEvent.fill(weightInput('verbose'), '95');
    await userEvent.keyboard('{Escape}');

    await settleRender();
    expect(rowNames()).toEqual(['compact', 'inherited', 'verbose']);
    expect(weightInput('verbose').value).toBe('95');
  });

  it('normalizes a cleared field instead of treating it as zero', async () => {
    setScope('');
    await mount();

    await userEvent.fill(weightInput('compact'), '');
    weightInput('compact').blur();

    await vi.waitFor(() => expect(weightInput('compact').value).toBe('50'));
  });

  it('steps a weight by the spinner carets', async () => {
    setScope('');
    await mount();

    rows()[0].querySelector<HTMLButtonElement>('button[aria-label="Increment"]')!.click();
    await vi.waitFor(() => expect(weightInput('compact').value).toBe('90.1'));

    rows()[0].querySelector<HTMLButtonElement>('button[aria-label="Decrement"]')!.click();
    await vi.waitFor(() => expect(weightInput('compact').value).toBe('90'));
  });

  it('ignores a spinner caret that would step past the end of the range', async () => {
    setScope('');
    await mount({ ...makeService({ loadWeights: () => Promise.resolve([{ name: 'top', scope: '', weight: 100 }]) }) });

    rows()[0].querySelector<HTMLButtonElement>('button[aria-label="Increment"]')!.click();

    expect(weightInput('top').value).toBe('100');
  });

  it('reorders by dragging a row onto the lower half of another', async () => {
    setScope('');
    await mount();

    fireDrag(rows()[0], 'dragstart');
    // A real drag spends frames between these events, and the component needs the render in between -
    // the row it is dragging is state, not something read back off the DOM.
    await vi.waitFor(() => expect(rows()[0].classList.contains('dragging')).toBe(true));

    fireDrag(rows()[2], 'dragover', 0.75);
    // The indicator sits on the edge the row would land on.
    await vi.waitFor(() => expect(rows()[2].classList.contains('drop-below')).toBe(true));

    fireDrag(rows()[2], 'drop', 0.75);

    await vi.waitFor(() => expect(rowNames()).toEqual(['inherited', 'verbose', 'compact']));
  });

  it('marks the upper edge when the pointer is in the top half of a row', async () => {
    setScope('');
    await mount();

    fireDrag(rows()[2], 'dragstart');
    await vi.waitFor(() => expect(rows()[2].classList.contains('dragging')).toBe(true));

    fireDrag(rows()[0], 'dragover', 0.25);

    await vi.waitFor(() => expect(rows()[0].classList.contains('drop-above')).toBe(true));
    expect(rows()[2].classList.contains('dragging')).toBe(true);
  });

  it('leaves the order alone when a row is dropped back where it started', async () => {
    setScope('');
    await mount();

    fireDrag(rows()[1], 'dragstart');
    await vi.waitFor(() => expect(rows()[1].classList.contains('dragging')).toBe(true));

    fireDrag(rows()[1], 'drop', 0.25);

    await vi.waitFor(() => expect(document.querySelectorAll('.dragging')).toHaveLength(0));
    expect(rowNames()).toEqual(['compact', 'inherited', 'verbose']);
    expect(weightInput('inherited').value).toBe('60');
  });

  it('ignores a drop that no drag of its own started', async () => {
    setScope('');
    await mount();

    fireDrag(rows()[2], 'drop', 0.25);

    await settleRender();
    expect(rowNames()).toEqual(['compact', 'inherited', 'verbose']);
  });

  it('marks no edge while something else is being dragged over the page', async () => {
    setScope('');
    await mount();

    // A drag that started outside the list (a file, a selection): hovering must not offer a drop edge.
    fireDrag(rows()[1], 'dragover', 0.75);

    await settleRender();
    expect(document.querySelectorAll('.drop-above, .drop-below')).toHaveLength(0);
  });

  it('drops the indicator when the pointer leaves the row it was on', async () => {
    setScope('');
    await mount();

    fireDrag(rows()[0], 'dragstart');
    await vi.waitFor(() => expect(rows()[0].classList.contains('dragging')).toBe(true));
    fireDrag(rows()[2], 'dragover', 0.75);
    await vi.waitFor(() => expect(rows()[2].classList.contains('drop-below')).toBe(true));

    fireDrag(rows()[2], 'dragleave');

    await vi.waitFor(() => expect(document.querySelectorAll('.drop-below')).toHaveLength(0));
  });

  it('shrugs off a dragleave that no dragover preceded', async () => {
    setScope('');
    await mount();

    fireDrag(rows()[0], 'dragstart');
    await vi.waitFor(() => expect(rows()[0].classList.contains('dragging')).toBe(true));

    fireDrag(rows()[1], 'dragleave');

    await settleRender();
    expect(document.querySelectorAll('.drop-above, .drop-below')).toHaveLength(0);
  });

  it('keeps the indicator when the pointer leaves a row that never had it', async () => {
    setScope('');
    await mount();

    fireDrag(rows()[0], 'dragstart');
    await vi.waitFor(() => expect(rows()[0].classList.contains('dragging')).toBe(true));
    fireDrag(rows()[2], 'dragover', 0.75);
    await vi.waitFor(() => expect(rows()[2].classList.contains('drop-below')).toBe(true));

    // The browser fires dragleave on the row being left, which may arrive after dragover on the new one.
    fireDrag(rows()[1], 'dragleave');

    await settleRender();
    expect(rows()[2].classList.contains('drop-below')).toBe(true);
  });

  it('clears the drag state when the drag is abandoned', async () => {
    setScope('');
    await mount();

    fireDrag(rows()[0], 'dragstart');
    await vi.waitFor(() => expect(rows()[0].classList.contains('dragging')).toBe(true));
    fireDrag(rows()[2], 'dragover', 0.75);
    await vi.waitFor(() => expect(rows()[2].classList.contains('drop-below')).toBe(true));

    fireDrag(rows()[0], 'dragend');

    await vi.waitFor(() => expect(document.querySelectorAll('.dragging, .drop-above, .drop-below')).toHaveLength(0));
  });

  it('saves only the packages this scope owns, each against the current scope', async () => {
    setScope('project/elibrary/');
    const saved: StylePackageWeight[][] = [];
    await mount(makeService({ saveWeights: (weights) => (saved.push(weights), Promise.resolve()) }));

    toolbarButton('Save').click();

    await vi.waitFor(() => expect(saved).toHaveLength(1));
    // 'inherited' is administered globally, so this scope does not write it back.
    expect(saved[0]).toEqual([
      { name: 'compact', scope: 'project/elibrary/', weight: 90 },
      { name: 'verbose', scope: 'project/elibrary/', weight: 30 },
    ]);
  });

  it('reports a failed save', async () => {
    setScope('');
    await mount(makeService({ saveWeights: () => Promise.reject(new Error('read-only setting')) }));

    toolbarButton('Save').click();

    await vi.waitFor(() => expect(document.body.textContent).toContain('read-only setting'));
  });

  it('says something generic when a failed save carries no message of its own', async () => {
    setScope('');
    await mount(makeService({ saveWeights: () => Promise.reject(new Error('')) }));

    toolbarButton('Save').click();

    await vi.waitFor(() => expect(document.body.textContent).toContain('Error occurred during saving the data'));
  });

  it('reloads from the server when the user confirms Cancel', async () => {
    setScope('');
    await mount();

    iconButton('Move verbose up').click();
    await vi.waitFor(() => expect(rowNames()).toEqual(['compact', 'verbose', 'inherited']));

    toolbarButton('Cancel').click();
    await answerDialog('OK');

    await vi.waitFor(() => expect(rowNames()).toEqual(['compact', 'inherited', 'verbose']));
  });

  it('keeps the edits when the user backs out of Cancel', async () => {
    setScope('');
    await mount();

    iconButton('Move verbose up').click();
    await vi.waitFor(() => expect(rowNames()).toEqual(['compact', 'verbose', 'inherited']));

    toolbarButton('Cancel').click();
    await answerDialog('Cancel');

    // Backing out leaves the reorder in place - nothing is reloaded.
    expect(rowNames()).toEqual(['compact', 'verbose', 'inherited']);
  });

  it('warns when the reload behind Cancel fails', async () => {
    setScope('');
    let calls = 0;
    await mount(
      makeService({
        loadWeights: () => (calls++ === 0 ? Promise.resolve([...GLOBAL_AND_OWN]) : Promise.reject(new Error('gone'))),
      }),
    );

    toolbarButton('Cancel').click();
    await answerDialog('OK');

    await vi.waitFor(() => expect(document.querySelector('.alert-error')).not.toBeNull());
  });

  it('offers no Default or Revisions button, since the endpoint has neither', async () => {
    setScope('');
    await mount();

    const labels = Array.from(document.querySelectorAll('.action-buttons .sbb-btn')).map((b) =>
      (b.textContent ?? '').trim(),
    );
    expect(labels).toEqual(['Save', 'Cancel']);
  });

  // The effect's cancelled flag: a scope switch or a closed pane unmounts the page while its request is
  // still in the air, and the answer must land on nothing rather than on a dead component.
  it.each([
    [
      'arrives',
      (settle: { resolve: (w: StylePackageWeight[]) => void; reject: (e: unknown) => void }) =>
        settle.resolve([...GLOBAL_AND_OWN]),
    ],
    [
      'fails',
      (settle: { resolve: (w: StylePackageWeight[]) => void; reject: (e: unknown) => void }) =>
        settle.reject(new Error('too late')),
    ],
  ])('ignores a load that %s after the page is gone', async (_name, settle) => {
    setScope('');
    let resolve!: (w: StylePackageWeight[]) => void;
    let reject!: (e: unknown) => void;
    const pending = new Promise<StylePackageWeight[]>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // Awaited: this render is asynchronous, and unmounting while it is still finishing tears the
    // container out from under it.
    await render(<StylePackageWeights title="Weights" service={makeService({ loadWeights: () => pending })} />);

    await cleanup();
    settle({ resolve, reject });
    await pending.catch(() => undefined);

    expect(document.querySelector('.weights-list')).toBeNull();
    expect(document.querySelector('.alert-error')).toBeNull();
  });

  it('warns when the weights cannot be loaded', async () => {
    setScope('');
    render(
      <StylePackageWeights
        title="Weights"
        service={makeService({ loadWeights: () => Promise.reject(new Error('boom')) })}
      />,
    );

    await vi.waitFor(() => expect(document.querySelector('.alert-error')).not.toBeNull());
    expect(document.querySelector('.alert-error')!.textContent).toContain('Error occurred loading the data');
  });
});
