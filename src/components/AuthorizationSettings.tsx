import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import useConfirm from '../hooks/useConfirm';
import type {
  AuthorizationContent,
  AuthorizationService,
  BundleVersion,
  RolesInfo,
} from '../services/authorizationSettings';
import { getScope } from '../services/scope';
import type { Revision } from '../types';
import './AuthorizationSettings.css';
import ConfigurationButtons from './ConfigurationButtons';
import PageLayout from './PageLayout';
import RevisionsTable from './RevisionsTable';

interface AuthorizationSettingsProps {
  /** Page heading, and what the administration entry is called in the menu. */
  title: string;
  /** The REST calls, normally from `createAuthorizationService(sendRequest, settingName)`. */
  service: AuthorizationService;
  /** The Quick Help section, which is the one genuinely per-extension part of this page. */
  quickHelp?: ReactNode;
}

/**
 * Administration page that grants a permission to a set of roles.
 *
 * Several extensions have this page and each had written it out: the global and project roles of the
 * current scope as checkboxes, the standard Save / Cancel / Default / Revisions toolbar, the revision
 * table, and a warning when the stored setting predates the installed bundle. All of that lives here;
 * the extension supplies which setting to read and write (through `service`) and its own help text.
 *
 * The setting is the generic single `Default` setting of whatever feature name the service was built
 * with, so one extension can have several of these pages over different settings.
 */
export default function AuthorizationSettings({ title, service, quickHelp }: AuthorizationSettingsProps) {
  const { confirm, confirmDialog } = useConfirm();

  const [roles, setRoles] = useState<RolesInfo>({ globalRoles: [], projectRoles: [] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [newerVersion, setNewerVersion] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisionsToken, setRevisionsToken] = useState(0);

  const scope = getScope();

  const applyContent = useCallback((content: AuthorizationContent) => {
    setSelected(new Set([...(content.globalRoles ?? []), ...(content.projectRoles ?? [])]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingError(false);
    Promise.all([
      service.loadRoles(scope),
      service.loadContent(scope),
      // Advisory only - a version the page cannot read simply means no warning.
      service.loadVersion?.().catch((): BundleVersion => ({})) ?? Promise.resolve<BundleVersion>({}),
    ])
      .then(([availableRoles, content, version]) => {
        if (cancelled) return;
        setRoles(availableRoles);
        applyContent(content);
        // Only claim the bundle is newer when both sides are known: without a version to compare
        // against, the page would otherwise warn on every load.
        setNewerVersion(
          Boolean(content.bundleTimestamp) &&
            Boolean(version.bundleBuildTimestamp) &&
            content.bundleTimestamp !== version.bundleBuildTimestamp,
        );
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

  const toggleRole = (role: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  /** Only roles that still exist are stored, so a removed role does not linger in the setting. */
  const buildPayload = (): AuthorizationContent => ({
    globalRoles: roles.globalRoles.filter((r) => selected.has(r)),
    projectRoles: roles.projectRoles.filter((r) => selected.has(r)),
  });

  const handleSave = async () => {
    toast.dismiss();
    try {
      await service.saveContent(scope, buildPayload());
      setNewerVersion(false);
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

  const renderRoles = (list: string[]) => (
    <ul className="roles-list">
      {list.map((role) => (
        <li key={role}>
          <label>
            <input type="checkbox" checked={selected.has(role)} onChange={() => toggleRole(role)} />
            <span>{role}</span>
          </label>
        </li>
      ))}
    </ul>
  );

  return (
    <PageLayout title={title}>
      <div className="notifications">
        {loadingError && (
          <div className="alert alert-error">
            Error occurred loading the data. Be sure Polarion is started and accessible.
          </div>
        )}
        {newerVersion && (
          <div className="alert alert-warning">
            A newer plugin version is installed than the one that saved these settings, which can lead to unexpected
            behaviour. Check that the saved data is still relevant. This message disappears after the next save.
          </div>
        )}
      </div>

      <div className="authorization-page">
        <div className="roles-group">
          <h2 className="align-left">Global Roles</h2>
          {roles.globalRoles.length > 0 ? renderRoles(roles.globalRoles) : <p>No global roles available.</p>}
        </div>

        {roles.projectRoles.length > 0 && (
          <div className="roles-group">
            <h2 className="align-left">Project Roles</h2>
            {renderRoles(roles.projectRoles)}
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
