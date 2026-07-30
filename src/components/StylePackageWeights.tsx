import { type DragEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import useConfirm from '../hooks/useConfirm';
import { getScope } from '../services/scope';
import type { StylePackageWeight, StylePackageWeightsService } from '../services/stylePackageWeights';
import ConfigurationButtons from './ConfigurationButtons';
import PageLayout from './PageLayout';
import './StylePackageWeights.css';

/** Bounds and granularity of a weight, as the vanilla page's number input declared them. */
const MIN_WEIGHT = 0;
const MAX_WEIGHT = 100;
const WEIGHT_STEP = 0.1;
/** What a cleared or unparseable field falls back to - the middle of the range, not an edge of it. */
const FALLBACK_WEIGHT = 50;

const LOCK_TITLE = 'Global scope — defined at the global level and cannot be reordered here';

const HANDLE_ICON = (
  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
    <circle cx="2" cy="3" r="1.4" />
    <circle cx="8" cy="3" r="1.4" />
    <circle cx="2" cy="8" r="1.4" />
    <circle cx="8" cy="8" r="1.4" />
    <circle cx="2" cy="13" r="1.4" />
    <circle cx="8" cy="13" r="1.4" />
  </svg>
);
const LOCK_ICON = (
  <svg
    width="13"
    height="14"
    viewBox="0 0 14 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    aria-hidden="true"
  >
    <rect x="2.2" y="7" width="9.6" height="7" rx="1.2" fill="currentColor" stroke="none" />
    <path d="M4.3 7V4.8a2.7 2.7 0 0 1 5.4 0V7" />
  </svg>
);
const CARET_UP_ICON = (
  <svg viewBox="0 0 8 5" fill="currentColor" aria-hidden="true">
    <path d="M4 0l4 5H0z" />
  </svg>
);
const CARET_DOWN_ICON = (
  <svg viewBox="0 0 8 5" fill="currentColor" aria-hidden="true">
    <path d="M0 0h8L4 5z" />
  </svg>
);
/** The spinner carets of the shared number field (`.sbb-number` in the generic inputs.css). */
const SPIN_UP_ICON = (
  <svg viewBox="4.4 6.27 7.2 4.2" aria-hidden="true">
    <path d="M4.4 10.47 L11.6 10.47 L8 6.27 Z" fill="currentColor" />
  </svg>
);
const SPIN_DOWN_ICON = (
  <svg viewBox="4.4 6.27 7.2 4.2" aria-hidden="true">
    <path d="M4.4 6.27 L11.6 6.27 L8 10.47 Z" fill="currentColor" />
  </svg>
);

/** One row of the list: a style package, its weight, and whether this scope may reorder it. */
export interface WeightEntry {
  name: string;
  scope: string;
  weight: number;
  /**
   * The weight this entry would rather keep - what the server sent, or the last value typed. A reorder
   * reuses it whenever it still fits between the new neighbours, so dragging a package away and back
   * does not quietly renumber it.
   */
  preferredWeight: number;
  /**
   * Defined at the global scope but shown in a narrower one: read-only here (it is administered
   * globally) and only a fixed reference point that other packages can be dropped above or below.
   * Called `static` in the vanilla class, and still that in the CSS.
   */
  readOnly: boolean;
}

/** Higher weight first, ties alphabetically - a stable order the user can predict. */
export function sortEntries(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
}

/**
 * The weight that keeps the entry at `index` where it now sits: its preferred weight when that still
 * falls between the neighbours, otherwise the middle of the gap (or one step past the outer edge).
 * Expects `entries` already arranged in the target order.
 */
export function computeWeightForPosition(entries: WeightEntry[], index: number): number {
  if (entries.length <= 1) {
    return entries[index].weight;
  }
  const preferred = entries[index].preferredWeight;
  let value: number;
  if (index === 0) {
    const next = entries[1].weight;
    value = preferred > next ? preferred : next + 1;
  } else if (index === entries.length - 1) {
    const previous = entries[entries.length - 2].weight;
    value = preferred < previous ? preferred : previous - 1;
  } else {
    const previous = entries[index - 1].weight;
    const next = entries[index + 1].weight;
    value =
      preferred > next && preferred < previous
        ? preferred
        : Number.parseFloat((previous + (next - previous) / 2).toFixed(1));
  }
  return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, value));
}

/**
 * Moves the entry at `fromIndex` into the slot at `insertIndex` (0..length), giving it the weight that
 * holds it there. Works across a read-only global entry, which never moves itself. Returns the new
 * arrangement, or null when nothing would change - the caller re-sorts either way.
 */
export function placeAt(entries: WeightEntry[], fromIndex: number, insertIndex: number): WeightEntry[] | null {
  // Both edges of the gap the entry already occupies mean "dropped back where it was".
  if (insertIndex === fromIndex || insertIndex === fromIndex + 1) {
    return null;
  }
  const moved = entries[fromIndex];
  if (!moved || moved.readOnly) {
    return null;
  }
  const next = [...entries];
  next.splice(fromIndex, 1);
  // Taking the entry out shifts every later slot up by one.
  const target = Math.max(0, Math.min(next.length, insertIndex > fromIndex ? insertIndex - 1 : insertIndex));
  const placed = { ...moved };
  next.splice(target, 0, placed);
  placed.weight = computeWeightForPosition(next, target);
  return next;
}

/**
 * Normalises a typed weight the way the vanilla page did: clamp to [0, 100], round to one decimal, and
 * fall back to 50 for anything that is not `NNN.N`.
 *
 * The shape test deliberately runs on the *number* rather than on the text that was typed, which is what
 * makes an unparseable field (`NaN`) land on 50 rather than on 0. Kept rather than tidied: that fallback
 * is the only thing between a cleared field and a weight of zero, which would silently drop the package
 * to the bottom of the list.
 */
export function normalizeWeight(raw: string | number): number {
  let value = typeof raw === 'number' ? raw : Number.parseFloat(raw);
  if (value > MAX_WEIGHT) {
    value = MAX_WEIGHT;
  }
  if (value < MIN_WEIGHT) {
    value = MIN_WEIGHT;
  }
  if (value % 1 !== 0) {
    value = Number.parseFloat(value.toFixed(1));
  }
  if (!/^\d{1,3}(\.\d)?$/.test(String(value))) {
    value = FALLBACK_WEIGHT;
  }
  return value;
}

/** Maps the endpoint's payload onto rows, deciding which of them this scope may reorder. */
function toEntries(weights: StylePackageWeight[], scope: string): WeightEntry[] {
  return sortEntries(
    weights.map((weight) => ({
      name: weight.name,
      scope: weight.scope,
      weight: weight.weight,
      preferredWeight: weight.weight,
      readOnly: weight.scope === '' && scope !== '',
    })),
  );
}

interface StylePackageWeightsProps {
  /** Page heading - the exporters prefix it with their own name ("PDF Exporter: Style Package Weights"). */
  title: string;
  /** The two REST calls, normally from `createStylePackageWeightsService(sendRequest)`. */
  service: StylePackageWeightsService;
}

/**
 * Administration page ordering an exporter's style packages by weight: higher weight means higher
 * position, and the top entry is the one preselected in the export panel's dropdown.
 *
 * Both exporters have this page, and it was already shared - not per extension, but as a vanilla class
 * in the generic framework driven by `ExtensionContext`. This is that class as a component, so the
 * second exporter does not reimplement it: the reordering (drag-and-drop and the caret buttons, both
 * rewriting weights), the read-only global entries, and the weight arithmetic all come over unchanged.
 * What stays per-extension is the endpoint, which arrives through `service`.
 *
 * The toolbar is Save / Cancel only, because the endpoint is only GET and POST - this page has no
 * default values and keeps no per-configuration revisions.
 */
export default function StylePackageWeights({ title, service }: Readonly<StylePackageWeightsProps>) {
  const { confirm, confirmDialog } = useConfirm();

  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  /** Index of the row being dragged, or null when no drag is in progress. */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** Where the drop would land: the hovered row and which of its edges. */
  const [dropTarget, setDropTarget] = useState<{ index: number; below: boolean } | null>(null);
  /**
   * Half-typed weights, by package name. A number field is left alone while it has focus - committing on
   * every keystroke would re-sort the list under the cursor - so the draft holds the text until the
   * field is left or Enter is pressed.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const scope = getScope();

  const fetchEntries = useCallback(
    () => service.loadWeights(scope).then((weights) => toEntries(weights, scope)),
    [service, scope],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingError(false);
    fetchEntries()
      .then((next) => {
        if (cancelled) return;
        setEntries(next);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadingError(true);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchEntries]);

  const rearrange = (fromIndex: number, insertIndex: number) => {
    setEntries((prev) => {
      const next = placeAt(prev, fromIndex, insertIndex);
      return next ? sortEntries(next) : prev;
    });
  };

  /** A weight typed by hand becomes the new preferred value, so a later reorder keeps it. */
  const commitWeight = (name: string, raw: string) => {
    const weight = normalizeWeight(raw);
    setEntries((prev) =>
      sortEntries(prev.map((e) => (e.name === name ? { ...e, weight, preferredWeight: weight } : e))),
    );
    setDrafts((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const stepWeight = (entry: WeightEntry, direction: 1 | -1) => {
    const stepped = Math.round((entry.weight + direction * WEIGHT_STEP) * 10) / 10;
    const clamped = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, stepped));
    // A click on the caret at either bound changes nothing; don't re-sort or dirty the preferred weight.
    if (clamped !== entry.weight) {
      commitWeight(entry.name, String(clamped));
    }
  };

  const handleSave = async () => {
    toast.dismiss();
    try {
      // Read-only globals are administered in the global scope; this scope stores only its own rows, and
      // stores them against itself even for a package it inherited and reweighted.
      await service.saveWeights(
        entries.filter((e) => !e.readOnly).map((e) => ({ name: e.name, scope, weight: e.weight })),
      );
      toast.success('Data successfully saved.');
    } catch (e) {
      toast.error((e as Error).message || 'Error occurred during saving the data.');
    }
  };

  const handleCancel = async () => {
    if (!(await confirm('Are you sure you want to cancel editing and revert all changes made?'))) return;
    try {
      setEntries(await fetchEntries());
      setDrafts({});
      setLoadingError(false);
      toast.dismiss();
    } catch {
      setLoadingError(true);
    }
  };

  /** Which half of the row the pointer is in decides whether the drop lands above or below it. */
  const isBottomHalf = (event: DragEvent<HTMLLIElement>): boolean => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY - rect.top > rect.height / 2;
  };

  const handleDragStart = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    // Some browsers ignore a drag that carries no payload.
    event.dataTransfer.setData('text/plain', String(index));
  };

  // Every row is a valid drop target, read-only ones included: the drop edge is what decides the
  // position, so a package can be placed directly above or below a locked global entry.
  const handleDragOver = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    if (dragIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget({ index, below: isBottomHalf(event) });
  };

  // Only the row that currently carries the indicator clears it. The browser may deliver dragleave for
  // the row being left after dragover for the row being entered, and clearing unconditionally would then
  // wipe the indicator the new row had just put up.
  const handleDragLeave = (index: number) => () => {
    if (dropTarget?.index === index) {
      setDropTarget(null);
    }
  };

  const handleDrop = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    if (dragIndex === null) return;
    event.preventDefault();
    rearrange(dragIndex, isBottomHalf(event) ? index + 1 : index);
    setDragIndex(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropTarget(null);
  };

  if (!loaded) {
    return (
      <PageLayout title={title}>
        <p>Loading...</p>
      </PageLayout>
    );
  }

  const itemClass = (entry: WeightEntry, index: number): string => {
    const classes = ['weight-item'];
    if (entry.readOnly) classes.push('static');
    if (dragIndex === index) classes.push('dragging');
    if (dropTarget?.index === index) classes.push(dropTarget.below ? 'drop-below' : 'drop-above');
    return classes.join(' ');
  };

  return (
    <PageLayout title={title}>
      <div className="notifications">
        {loadingError && (
          <div className="alert alert-error">
            Error occurred loading the data. Be sure Polarion is started and accessible.
          </div>
        )}
      </div>

      <div className="style-package-weights">
        <p className="weights-intro">
          The higher the number, the higher resulting item&apos;s position will be. The highest item will be
          pre-selected in the dropdown on the export panel.
        </p>

        <ul className="weights-list">
          {entries.map((entry, index) => (
            <li
              key={entry.name}
              className={itemClass(entry, index)}
              draggable={!entry.readOnly}
              onDragStart={entry.readOnly ? undefined : handleDragStart(index)}
              onDragEnd={entry.readOnly ? undefined : handleDragEnd}
              onDragOver={handleDragOver(index)}
              onDragLeave={handleDragLeave(index)}
              onDrop={handleDrop(index)}
            >
              {entry.readOnly ? (
                <span className="lock-marker" title={LOCK_TITLE}>
                  {LOCK_ICON}
                </span>
              ) : (
                <span className="drag-handle" title="Drag to reorder">
                  {HANDLE_ICON}
                </span>
              )}

              <span className="name">{entry.name}</span>

              <span className="sbb-number">
                <input
                  // The id the vanilla page gave this field, kept so an external locator still finds it.
                  id={`input.weight.${entry.name}`}
                  className="weight-input"
                  type="number"
                  min={MIN_WEIGHT}
                  max={MAX_WEIGHT}
                  step={WEIGHT_STEP}
                  aria-label={`Weight of ${entry.name}`}
                  readOnly={entry.readOnly}
                  value={drafts[entry.name] ?? String(entry.weight)}
                  onChange={(event) => setDrafts((prev) => ({ ...prev, [entry.name]: event.target.value }))}
                  onBlur={(event) => commitWeight(entry.name, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitWeight(entry.name, event.currentTarget.value);
                    }
                  }}
                />
                {/* No spinner on a locked row: the field is inert there, and carets that look live but
                    do nothing were the one thing worth changing about the vanilla page. */}
                {!entry.readOnly && (
                  <span className="sbb-number-spin">
                    <button type="button" tabIndex={-1} aria-label="Increment" onClick={() => stepWeight(entry, 1)}>
                      {SPIN_UP_ICON}
                    </button>
                    <button type="button" tabIndex={-1} aria-label="Decrement" onClick={() => stepWeight(entry, -1)}>
                      {SPIN_DOWN_ICON}
                    </button>
                  </span>
                )}
              </span>

              {entry.readOnly ? (
                <span className="reorder-arrows placeholder" />
              ) : (
                <span className="reorder-arrows">
                  <button
                    type="button"
                    title="Move up"
                    aria-label={`Move ${entry.name} up`}
                    disabled={index === 0}
                    onClick={() => rearrange(index, index - 1)}
                  >
                    {CARET_UP_ICON}
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    aria-label={`Move ${entry.name} down`}
                    disabled={index === entries.length - 1}
                    // One past the row below, because an insert slot sits between rows.
                    onClick={() => rearrange(index, index + 2)}
                  >
                    {CARET_DOWN_ICON}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>

        <ConfigurationButtons onSave={handleSave} onCancel={handleCancel} />
      </div>

      {confirmDialog}
    </PageLayout>
  );
}
