import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import useConfirm from '../hooks/useConfirm';
import { getCookie, setCookie } from '../services/cookies';
import type { SettingName } from '../types';
import './ConfigurationsPane.css';
import Modal from './Modal';
import SearchableSelect from './SearchableSelect';

const INVALID_CHARS = /[^a-zA-Z0-9\-_ ]+/;
const DEFAULT_NAME = 'Default';
const NAME_MAX_LENGTH = 40;

export interface ConfigurationsPaneHandle {
  /** Reload the configuration names, optionally preferring a specific selection afterwards. */
  reloadNames: (preferred?: string) => Promise<void>;
}

/**
 * The named-settings REST operations the pane needs, injected by the consuming app. This is a subset
 * of an extension's settings hook (e.g. its `useSettings`), so that object can be passed
 * directly. `T` is the extension-specific configuration content type returned by `loadContent`.
 */
export interface ConfigurationsService<T> {
  loadConfigurationNames: (scope: string) => Promise<SettingName[]>;
  loadContent: (name: string, scope: string) => Promise<T>;
  createConfiguration: (name: string, scope: string) => Promise<void>;
  renameConfiguration: (name: string, scope: string, newName: string) => Promise<void>;
  deleteConfiguration: (name: string, scope: string) => Promise<void>;
}

/**
 * Whether the scope offers the configurations that come from the global level, edited through the pane's
 * own dialog. Pass it and the pane grows a "Change visibility" button next to "Add new"; leave it out and
 * the pane has no such button, which is what every scope that cannot hide anything wants.
 *
 * It is deliberately a value plus a writer rather than a settings feature of its own: what the flag is
 * stored in differs per extension (its own document, a property, a column), and the pane only has to show
 * it and hand back what the administrator chose.
 */
export interface ConfigurationsVisibility {
  /** Whether this scope currently hides the configurations defined on the global level. */
  globalHidden: boolean;
  /** Stores the value the administrator picked. The pane reloads its list once this resolves. */
  onChange: (globalHidden: boolean) => Promise<void>;
  /** What the dialog says on top of the generic explanation, e.g. what the extension does besides hiding. */
  note?: ReactNode;
  /** Greys the button out, e.g. while the stored value is still being read or reading it failed. */
  disabled?: boolean;
}

interface ConfigurationsPaneProps<T> {
  scope: string;
  /** REST operations for the named settings (see ConfigurationsService). */
  service: ConfigurationsService<T>;
  /** Cookie name used to remember the last selection, e.g. "selected-configuration-mappings". */
  cookieKey: string;
  /** Singular noun for the configuration in labels, e.g. "mapping". */
  label?: string;
  /** Called with the loaded content whenever a configuration is selected (fills the form). */
  onContentLoaded: (settings: T) => void;
  /** Called with the currently selected configuration name (save target / revisions key). */
  onSelectedChange: (name: string | null) => void;
  /** Called when the create/rename name editor opens or closes, so the form can be dimmed. */
  onEditingNameChange?: (editing: boolean) => void;
  /** The visibility of the configurations of the global level; omit it and the pane offers no such button. */
  visibility?: ConfigurationsVisibility;
  /** Imperative handle (React 19 ref-as-prop) exposing reloadNames. */
  ref?: Ref<ConfigurationsPaneHandle>;
}

type Mode = 'view' | 'new' | 'rename';

/**
 * React reimplementation of the generic `ConfigurationsPane`: the named-configuration selector plus
 * create / rename / delete, the Default and inherited-from-global notes, and the same name
 * validation and error messages. It is decoupled from any specific extension: the REST calls come in
 * through the `service` prop and the content type is the generic parameter `T`. Exposes `reloadNames`
 * via the `ref` prop so the parent can refresh the list after a save.
 *
 * The error banners use the `alert`/`alert-error` classes, which the consuming app provides (its own
 * CSS or the generic `alerts.css`).
 */
export function ConfigurationsPane<T>({
  scope,
  service,
  cookieKey,
  label = 'configuration',
  onContentLoaded,
  onSelectedChange,
  onEditingNameChange,
  visibility,
  ref,
}: Readonly<ConfigurationsPaneProps<T>>) {
  const { loadConfigurationNames, loadContent, createConfiguration, renameConfiguration, deleteConfiguration } =
    service;

  const { confirm, confirmDialog } = useConfirm();
  const [names, setNames] = useState<SettingName[]>([]);
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState<Mode>('view');
  const [nameInput, setNameInput] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  // The visibility dialog: what it shows while open, and how the write it triggers went.
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [visibilityDraft, setVisibilityDraft] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityError, setVisibilityError] = useState(false);
  /**
   * Bumped when a visibility change rewrote the list, to rebuild the selector below from scratch.
   *
   * Reading the names again is not enough: hiding the global level turns an inherited configuration into
   * one of this scope, which changes how an option is *marked* while its id and its position stay put.
   * SearchableDropdown re-reads the list from a MutationObserver watching the `<select>` for children
   * coming and going, so a change inside an option it already knows leaves the trigger and the popup
   * showing the old marker until the page is reloaded by hand. Rebuilding the control is the fix that
   * stays out of the vendored code (which must not be hand-edited, see CLAUDE.md) and out of every other
   * consumer's rendering: create / rename / delete change which options exist, which the observer sees.
   */
  const [selectorEpoch, setSelectorEpoch] = useState(0);

  // Keep the latest callbacks in refs so fetchNames/selectConfig stay stable across parent renders.
  const contentLoadedRef = useRef(onContentLoaded);
  contentLoadedRef.current = onContentLoaded;
  const selectedChangeRef = useRef(onSelectedChange);
  selectedChangeRef.current = onSelectedChange;
  const editingNameRef = useRef(onEditingNameChange);
  editingNameRef.current = onEditingNameChange;

  const selectConfig = useCallback(
    async (name: string) => {
      setSelected(name);
      setCookie(cookieKey, name);
      selectedChangeRef.current(name);
      try {
        const settings = await loadContent(name, scope);
        contentLoadedRef.current(settings);
      } catch {
        setLoadError(true);
      }
    },
    [loadContent, scope, cookieKey],
  );

  const fetchNames = useCallback(
    async (preferred?: string) => {
      setLoadError(false);
      try {
        const list = await loadConfigurationNames(scope);
        setNames(list);
        if (list.length === 0) {
          setSelected('');
          selectedChangeRef.current(null);
          return;
        }
        const cookieName = getCookie(cookieKey);
        const listed = (name: string | null | undefined): name is string => !!name && list.some((n) => n.name === name);
        // An explicitly requested name wins (it was just created or renamed), then the remembered one,
        // and failing both the first entry.
        let pick: string;
        if (listed(preferred)) {
          pick = preferred;
        } else if (listed(cookieName)) {
          pick = cookieName;
        } else {
          pick = list[0].name;
        }
        await selectConfig(pick);
      } catch {
        setLoadError(true);
      }
    },
    [loadConfigurationNames, scope, cookieKey, selectConfig],
  );

  useImperativeHandle(ref, () => ({ reloadNames: fetchNames }), [fetchNames]);

  useEffect(() => {
    fetchNames();
  }, [fetchNames]);

  const isParentOption = useCallback(
    (name: string): boolean => {
      const sn = names.find((n) => n.name === name);
      return !!sn && sn.scope !== scope;
    },
    [names, scope],
  );

  // Clash check ignores inherited (parent-scope) options: a project scope may override a global name.
  const nameClashes = useCallback(
    (value: string, ignore: string | null): boolean =>
      names.some((n) => n.scope === scope && n.name !== ignore && n.name === value),
    [names, scope],
  );

  const showDefaultNote = scope === '' && selected === DEFAULT_NAME;
  const showGlobalNote = scope !== '' && isParentOption(selected);
  const editingDisabled = showDefaultNote || showGlobalNote;

  const openEditor = (nextMode: 'new' | 'rename') => {
    setNameError(null);
    setDeleteError(false);
    setNameInput(nextMode === 'rename' ? selected : '');
    setMode(nextMode);
    editingNameRef.current?.(true);
  };

  const closeEditor = () => {
    setMode('view');
    setNameInput('');
    setNameError(null);
    editingNameRef.current?.(false);
  };

  const validateName = (value: string, ignore: string | null): string | null => {
    if (INVALID_CHARS.test(value)) {
      return 'Only alphanumeric characters, hyphens and spaces are allowed';
    }
    if (nameClashes(value, ignore)) {
      return `A ${label} with this name already exists`;
    }
    return null;
  };

  const submitCreate = async () => {
    const error = validateName(nameInput, null);
    if (error) {
      setNameError(error);
      return;
    }
    try {
      await createConfiguration(nameInput, scope);
      setCookie(cookieKey, nameInput);
      const created = nameInput;
      closeEditor();
      await fetchNames(created);
    } catch (e) {
      setNameError((e as Error).message || `Error occurred while saving the ${label}`);
    }
  };

  const submitRename = async () => {
    const error = validateName(nameInput, selected);
    if (error) {
      setNameError(error);
      return;
    }
    try {
      await renameConfiguration(selected, scope, nameInput);
      setCookie(cookieKey, nameInput);
      const renamed = nameInput;
      closeEditor();
      await fetchNames(renamed);
    } catch (e) {
      setNameError((e as Error).message || `Error occurred while saving the ${label}`);
    }
  };

  const handleDelete = async () => {
    if (
      !(await confirm(`Are you sure you want to delete this ${label}?`, { title: `Delete ${label}`, okText: 'Delete' }))
    ) {
      return;
    }
    setDeleteError(false);
    try {
      await deleteConfiguration(selected, scope);
      await fetchNames();
    } catch {
      setDeleteError(true);
    }
  };

  const openVisibility = () => {
    setVisibilityDraft(visibility?.globalHidden ?? false);
    setVisibilityError(false);
    setVisibilityOpen(true);
  };

  const submitVisibility = async () => {
    if (!visibility) {
      return;
    }
    setVisibilitySaving(true);
    setVisibilityError(false);
    try {
      await visibility.onChange(visibilityDraft);
      setVisibilityOpen(false);
      // Hiding or showing the global level changes which configurations exist here, so the list the pane
      // offers - and the content the parent has in its form - are read again.
      await fetchNames();
      setSelectorEpoch((epoch) => epoch + 1);
    } catch {
      setVisibilityError(true);
    } finally {
      setVisibilitySaving(false);
    }
  };

  return (
    <div className="configurations-pane">
      {mode === 'view' ? (
        <>
          <div className="config-row">
            <label>Selected {label}:</label>
            <SearchableSelect
              key={selectorEpoch}
              value={selected}
              onChange={selectConfig}
              options={names.map((n) => ({ id: n.name, name: n.name, inherited: n.scope !== scope }))}
            />
            <button
              type="button"
              className="sbb-btn sbb-btn--control"
              title={`Rename ${label}`}
              disabled={editingDisabled || !selected}
              onClick={() => openEditor('rename')}
            >
              <span className="button-image sbb-icon-edit" aria-hidden="true" />
              <span>Rename</span>
            </button>
            <button
              type="button"
              className="sbb-btn sbb-btn--control"
              title={`Delete ${label}`}
              disabled={editingDisabled || !selected}
              onClick={handleDelete}
            >
              <span className="button-image sbb-icon-delete" aria-hidden="true" />
              <span>Delete</span>
            </button>
            <button
              type="button"
              className="sbb-btn sbb-btn--control"
              title={`Add new ${label}`}
              onClick={() => openEditor('new')}
            >
              <span className="button-image sbb-icon-table-plus" aria-hidden="true" />
              <span>Add new</span>
            </button>
            {visibility && (
              <>
                <span className="config-separator" aria-hidden="true">
                  |
                </span>
                {/* No glyph on purpose: the shared icon set has none for visibility, and reusing the
                    pencil of "Rename" two buttons along would read as the same kind of action. The
                    separator is what marks this one as the odd one out. */}
                <button
                  type="button"
                  className="sbb-btn sbb-btn--control"
                  title={`Change visibility of ${label}s`}
                  disabled={visibility.disabled}
                  onClick={openVisibility}
                >
                  <span>Change visibility</span>
                </button>
              </>
            )}
          </div>
          {showDefaultNote && (
            <p className="config-note">
              <i>The Default {label} can't be renamed or deleted.</i>
            </p>
          )}
          {showGlobalNote && (
            <p className="config-note">
              <i>
                This {label} is inherited from the global scope. To rename or delete it on the project scope you need to
                save it on this level first.
              </i>
            </p>
          )}
          {loadError && <div className="alert alert-error">Error occurred loading the list of {label}s.</div>}
          {deleteError && <div className="alert alert-error">Error occurred while deleting the {label}.</div>}
        </>
      ) : (
        <div className="config-row config-edit-row">
          <label>{mode === 'new' ? `New ${label} name:` : `Rename ${label} to:`}</label>
          <input
            type="text"
            maxLength={NAME_MAX_LENGTH}
            value={nameInput}
            autoFocus
            onChange={(e) => setNameInput(e.target.value)}
          />
          <button type="button" className="sbb-btn sbb-btn--control" onClick={closeEditor}>
            <span className="button-image sbb-icon-cancel" aria-hidden="true" />
            <span>Cancel</span>
          </button>
          <button
            type="button"
            className="sbb-btn sbb-btn--control"
            disabled={nameInput.trim().length === 0}
            onClick={mode === 'new' ? submitCreate : submitRename}
          >
            <span className="button-image sbb-icon-save" aria-hidden="true" />
            {mode === 'new' ? 'Save' : 'Update'}
          </button>
          {nameError && <div className="alert alert-error">{nameError}</div>}
        </div>
      )}
      {visibility && (
        <Modal
          open={visibilityOpen}
          title={`Visibility of ${label}s`}
          okText="Change"
          cancelText="Cancel"
          okDisabled={visibilitySaving || visibilityDraft === visibility.globalHidden}
          onOk={() => void submitVisibility()}
          onCancel={() => setVisibilityOpen(false)}
        >
          {/* `modal__container` is what the shared checkbox and input CSS is scoped to, so the box below
              looks the same here as on the page, whatever the consumer wrapped the pane in. */}
          <div className="modal__container config-visibility-dialog">
            {scope === '' ? (
              <p>
                The {label}s defined here, on the global level, are offered in every project next to the ones the
                project defines itself. Hiding them applies to every project which does not set this itself. The global
                level keeps listing its own {label}s.
              </p>
            ) : (
              <p>
                The {label}s defined on the global level are offered in this project next to the ones it defines itself.
                Hide them and only the {label}s of this project are offered.
              </p>
            )}
            {visibility.note}
            <label className="config-visibility-toggle">
              <input
                type="checkbox"
                checked={visibilityDraft}
                disabled={visibilitySaving}
                onChange={(e) => setVisibilityDraft(e.target.checked)}
              />
              Hide {label}s defined on the global level
            </label>
            {visibilityError && (
              <div className="alert alert-error">Error occurred while saving the visibility of the {label}s.</div>
            )}
          </div>
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
}
