import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import useConfirm from '../hooks/useConfirm';
import { getCookie, setCookie } from '../services/cookies';
import type { SettingName } from '../types';
import './ConfigurationsPane.css';
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
  ref,
}: ConfigurationsPaneProps<T>) {
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
        const pick =
          preferred && list.some((n) => n.name === preferred)
            ? preferred
            : cookieName && list.some((n) => n.name === cookieName)
              ? cookieName
              : list[0].name;
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

  return (
    <div className="configurations-pane">
      {mode === 'view' ? (
        <>
          <div className="config-row">
            <label>Selected {label}:</label>
            <SearchableSelect
              value={selected}
              onChange={selectConfig}
              options={names.map((n) => ({ id: n.name, name: n.scope !== scope ? `${n.name} (inherited)` : n.name }))}
            />
            <button
              type="button"
              className="sbb-btn sbb-btn--control"
              title={`Rename ${label}`}
              disabled={editingDisabled || !selected}
              onClick={() => openEditor('rename')}
            >
              <span className="button-image sbb-icon-edit" role="img" aria-label="Rename" />
              Rename
            </button>
            <button
              type="button"
              className="sbb-btn sbb-btn--control"
              title={`Delete ${label}`}
              disabled={editingDisabled || !selected}
              onClick={handleDelete}
            >
              <span className="button-image sbb-icon-delete" role="img" aria-label="Delete" />
              Delete
            </button>
            <button
              type="button"
              className="sbb-btn sbb-btn--control"
              title={`Add new ${label}`}
              onClick={() => openEditor('new')}
            >
              <span className="button-image sbb-icon-table-plus" role="img" aria-label="Add" />
              Add new
            </button>
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
            <span className="button-image sbb-icon-cancel" role="img" aria-label="Cancel" />
            Cancel
          </button>
          <button
            type="button"
            className="sbb-btn sbb-btn--control"
            disabled={nameInput.trim().length === 0}
            onClick={mode === 'new' ? submitCreate : submitRename}
          >
            <span className="button-image sbb-icon-save" role="img" aria-label={mode === 'new' ? 'Save' : 'Update'} />
            {mode === 'new' ? 'Save' : 'Update'}
          </button>
          {nameError && <div className="alert alert-error">{nameError}</div>}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
