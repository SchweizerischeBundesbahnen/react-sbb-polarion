import './ConfigurationButtons.css';

interface ConfigurationButtonsProps {
  onSave: () => void;
  onCancel: () => void;
  /**
   * "Load default values" handler. Optional: the Default button is rendered only when this is
   * provided, so a page that has no default (e.g. excel-importer's Mappings) hides it by omitting it.
   */
  onRevertToDefault?: () => void;
  onToggleRevisions: () => void;
  /** Whether the revisions table is currently shown; drives the Revisions button's aria-pressed. */
  revisionsShown?: boolean;
}

/**
 * The standard configuration action toolbar - Save / Cancel / Default / Revisions - sitting on the gray
 * bar of the generic admin pages (`common.css` `.actions-pane` + `buttons.jsp`). Extracted so every
 * ported settings page shares one toolbar. The buttons are the unified control look (`sbb-btn
 * sbb-btn--control`) with the same `.sbb-icon-*` glyphs as the legacy JSP; the `--sbb-*` button tokens
 * resolve from the app's `body.sbb-ui` / `.standard-admin-page` scope. Each action is a callback prop;
 * the component holds no state. The Default button is optional (see `onRevertToDefault`).
 */
export default function ConfigurationButtons({
  onSave,
  onCancel,
  onRevertToDefault,
  onToggleRevisions,
  revisionsShown,
}: ConfigurationButtonsProps) {
  return (
    <div className="actions-pane">
      <div className="action-buttons">
        <button type="button" className="sbb-btn sbb-btn--control" onClick={onSave}>
          <span className="button-image sbb-icon-save" role="img" aria-label="Save" title="Save data" />
          Save
        </button>
        <button
          type="button"
          className="sbb-btn sbb-btn--control"
          title="Cancel editing and revert to last persisted state"
          onClick={onCancel}
        >
          <span className="button-image sbb-icon-cancel" role="img" aria-label="Cancel" />
          Cancel
        </button>
        {onRevertToDefault && (
          <button
            type="button"
            className="sbb-btn sbb-btn--control"
            title="Load default values"
            onClick={onRevertToDefault}
          >
            <span className="button-image sbb-icon-revert" role="img" aria-label="Default" />
            Default
          </button>
        )}
        <button
          type="button"
          className="sbb-btn sbb-btn--control"
          title="Toggle list of revisions"
          aria-pressed={revisionsShown}
          onClick={onToggleRevisions}
        >
          <span className="button-image sbb-icon-select-revision" role="img" aria-label="Revisions" />
          Revisions
        </button>
      </div>
    </div>
  );
}
