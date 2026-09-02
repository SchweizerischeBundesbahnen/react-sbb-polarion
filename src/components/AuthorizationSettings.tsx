import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import useConfirm from '../hooks/useConfirm';
import type { AuthorizationContent, AuthorizationService, RolesInfo } from '../services/authorizationSettings';
import { getScope } from '../services/scope';
import type { Revision } from '../types';
import './AuthorizationSettings.css';
import ConfigurationButtons from './ConfigurationButtons';
import PageLayout from './PageLayout';
import RevisionsTable from './RevisionsTable';
import SearchableSelect, { type SelectOption } from './SearchableSelect';

interface AuthorizationSettingsProps {
  /** Page heading, and what the administration entry is called in the menu. */
  title: string;
  /** The REST calls, normally from `createAuthorizationService(sendRequest, settingName)`. */
  service: AuthorizationService;
  /** The Quick Help section, which is the one genuinely per-extension part of this page. */
  quickHelp?: ReactNode;
}

/** Nothing granted, and nothing to grant - the state both role sets start in. */
const NO_ROLES: AuthorizationContent = { globalRoles: [], projectRoles: [] };

/** Shown on an empty control, in place of the chips a granted role paints. */
const NOTHING_SELECTED = 'No roles selected';

/** A role is its own option id: the name is what the setting stores. */
function toOptions(roles: string[]): SelectOption[] {
  return roles.map((role) => ({ id: role, name: role }));
}

/**
 * Administration page that grants a permission to a set of roles.
 *
 * Several extensions have this page and each had written it out: the global and project roles of the
 * current scope, the standard Save / Cancel / Default / Revisions toolbar, the revision table, and a
 * warning when the stored setting predates the installed bundle. All of that lives here; the extension
 * supplies which setting to read and write (through `service`) and its own help text.
 *
 * Each role set is one multi-select {@link SearchableSelect}: the granted roles are chips on the
 * trigger, the rest are checkbox options behind a search box. This replaced two lists of checkboxes,
 * which put every role of the scope on screen at once - a Polarion instance with dozens of global roles
 * pushed the toolbar below the fold and left the administrator scanning the list for the three that
 * were ticked.
 *
 * The setting is the generic single `Default` setting of whatever feature name the service was built
 * with, so one extension can have several of these pages over different settings.
 */
export default function AuthorizationSettings({ title, service, quickHelp }: Readonly<AuthorizationSettingsProps>) {
  const { confirm, confirmDialog } = useConfirm();

  const [roles, setRoles] = useState<RolesInfo>(NO_ROLES);
  const [selected, setSelected] = useState<AuthorizationContent>(NO_ROLES);
  const [loaded, setLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisionsToken, setRevisionsToken] = useState(0);

  const scope = getScope();

  const applyContent = useCallback((content: AuthorizationContent) => {
    setSelected({ globalRoles: content.globalRoles ?? [], projectRoles: content.projectRoles ?? [] });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingError(false);
    Promise.all([service.loadRoles(scope), service.loadContent(scope)])
      .then(([availableRoles, content]) => {
        if (cancelled) return;
        setRoles(availableRoles);
        applyContent(content);
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
  }, [service, scope, applyContent]);

  /** Only roles that still exist are stored, and in the order the scope lists them, so a removed role
   *  does not linger in the setting and the stored order does not depend on the order of picking. */
  const buildPayload = (): AuthorizationContent => ({
    globalRoles: roles.globalRoles.filter((role) => selected.globalRoles.includes(role)),
    projectRoles: roles.projectRoles.filter((role) => selected.projectRoles.includes(role)),
  });

  const handleSave = async () => {
    toast.dismiss();
    try {
      await service.saveContent(scope, buildPayload());
      setRevisionsToken((t) => t + 1);
      toast.success('Data successfully saved.');
    } catch (e) {
      toast.error((e as Error).message || 'Error occurred during saving the data.');
    }
  };

  const handleCancel = async () => {
    if (!(await confirm('Are you sure you want to cancel editing and revert all changes made?'))) return;
    try {
      applyContent(await service.loadContent(scope));
      toast.dismiss();
    } catch {
      setLoadingError(true);
    }
  };

  const handleRevertToDefault = async () => {
    if (!(await confirm('Are you sure you want to return the default values?'))) return;
    toast.dismiss();
    try {
      applyContent(await service.loadDefaultContent());
      toast.success('Reverted to the default values. Remember to save the configuration.');
    } catch {
      setLoadingError(true);
    }
  };

  const handleRevertToRevision = async (revision: Revision) => {
    try {
      applyContent(await service.loadContent(scope, revision.name));
      toast.success(`Reverted to revision ${revision.name}. Don't forget to save.`);
    } catch {
      setLoadingError(true);
    }
  };

  if (!loaded) {
    return (
      <PageLayout title={title}>
        <p>Loading...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={title}>
      <div className="notifications">
        {loadingError && (
          <div className="alert alert-error">
            Error occurred loading the data. Be sure Polarion is started and accessible.
          </div>
        )}
      </div>

      <div className="authorization-page">
        <div className="roles-group">
          <h2 className="align-left">Global Roles</h2>
          {roles.globalRoles.length > 0 ? (
            <SearchableSelect
              multiple
              id="global-roles"
              ariaLabel="Global Roles"
              options={toOptions(roles.globalRoles)}
              value={selected.globalRoles}
              placeholder={NOTHING_SELECTED}
              onChange={(values) => setSelected((prev) => ({ ...prev, globalRoles: values }))}
            />
          ) : (
            <p>No global roles available.</p>
          )}
        </div>

        {roles.projectRoles.length > 0 && (
          <div className="roles-group">
            <h2 className="align-left">Project Roles</h2>
            <SearchableSelect
              multiple
              id="project-roles"
              ariaLabel="Project Roles"
              options={toOptions(roles.projectRoles)}
              value={selected.projectRoles}
              placeholder={NOTHING_SELECTED}
              onChange={(values) => setSelected((prev) => ({ ...prev, projectRoles: values }))}
            />
          </div>
        )}

        <ConfigurationButtons
          onSave={handleSave}
          onCancel={handleCancel}
          onRevertToDefault={handleRevertToDefault}
          onToggleRevisions={() => setShowRevisions((v) => !v)}
          revisionsShown={showRevisions}
        />

        {showRevisions && (
          <RevisionsTable
            name={service.defaultName}
            scope={scope}
            reloadToken={revisionsToken}
            loadRevisions={service.loadRevisions}
            onRevert={handleRevertToRevision}
          />
        )}
      </div>

      {confirmDialog}

      {quickHelp && (
        <div className="quick-help">
          <h2 className="align-left">Quick Help</h2>
          <div className="quick-help-text">{quickHelp}</div>
        </div>
      )}
    </PageLayout>
  );
}
