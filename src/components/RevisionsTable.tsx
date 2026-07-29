import { useEffect, useState } from 'react';
import type { Revision } from '../types';
import './RevisionsTable.css';

interface RevisionsTableProps {
  /** The selected configuration name; revisions are listed for it. */
  name: string;
  scope: string;
  /** Bumping this re-fetches the list (e.g. after a save creates a new revision). */
  reloadToken: number;
  /**
   * REST call that lists the revisions of the named setting, injected by the consuming app. This is a
   * subset of an extension's settings hook (e.g. its `useSettings().loadRevisions`), so that function
   * can be passed straight in.
   */
  loadRevisions: (name: string, scope: string) => Promise<Revision[]>;
  /** Load the configuration content at the given revision into the form (unsaved). */
  onRevert: (revision: Revision) => void;
}

/** Group a numeric revision name with spaces as the thousands separator (e.g. 3388 -> "3 388"),
 * mirroring the generic `insertRevisionSpaces`. Non-numeric names are returned unchanged. */
function formatRevision(name: string): string {
  // The lookahead is anchored to the end rather than written as `(\d{3})+(?!\d)`: the guard above
  // already established the whole name is digits, so the two are equivalent, and anchoring keeps the
  // repeated group from backtracking over every split.
  return /^\d+$/.test(name) ? name.replace(/\B(?=(?:\d{3})+$)/g, ' ') : name;
}

/**
 * The revisions table for the selected configuration, matching the generic
 * `ExtensionContext.readAndFillRevisions` look: sticky centered headers, zebra rows, a right-aligned
 * revision number, centered Date and Actions columns, and a per-row green revert-arrow icon button
 * that loads that revision's content into the form. Rendered only while the "Revisions" toggle is on.
 *
 * Decoupled from any specific extension: the REST call comes in through the `loadRevisions` prop.
 */
export default function RevisionsTable({
  name,
  scope,
  reloadToken,
  loadRevisions,
  onRevert,
}: Readonly<RevisionsTableProps>) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!name) {
      setRevisions([]);
      return;
    }
    setError(false);
    loadRevisions(name, scope)
      .then((items) => {
        if (!cancelled) setRevisions(items);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadRevisions, name, scope, reloadToken]);

  return (
    <div className="revisions-expand-container">
      {error ? (
        <div className="alert alert-error">Could not load revisions.</div>
      ) : (
        <table className="revisions-table">
          <thead>
            <tr>
              <th>Revision</th>
              <th>Baseline name</th>
              <th>Date</th>
              <th>Author</th>
              <th>Comment</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {revisions.length === 0 ? (
              <tr>
                <td className="empty-message" colSpan={6}>
                  <i>No revisions.</i>
                </td>
              </tr>
            ) : (
              revisions.map((revision) => (
                <tr key={revision.name}>
                  <td>
                    <span className="revision-number">{formatRevision(revision.name)}</span>
                  </td>
                  <td>{revision.baseline ?? ''}</td>
                  <td>{revision.date ?? ''}</td>
                  <td>{revision.author ?? ''}</td>
                  <td>{revision.description ?? ''}</td>
                  <td>
                    <button
                      type="button"
                      className="revert-to-revision-button"
                      title="Revert to this revision"
                      aria-label="Revert to this revision"
                      onClick={() => onRevert(revision)}
                    >
                      <span className="revert-to-revision-icon" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
