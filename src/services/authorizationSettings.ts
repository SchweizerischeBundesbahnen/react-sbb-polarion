import type { Revision, SendRequest } from '../types';
import { jsonOrThrow, okOrThrow } from './rest';

/** The single, always-present setting name the generic framework uses when there are no named configs. */
const DEFAULT_NAME = 'Default';

/** Content of an authorization setting: the roles allowed to do the thing it guards. */
export interface AuthorizationContent {
  globalRoles: string[];
  projectRoles: string[];
}

/** Roles available to grant in the current scope, from generic's `/roles` endpoint. */
export interface RolesInfo {
  globalRoles: string[];
  projectRoles: string[];
}

/** What {@link AuthorizationSettings} needs; an extension normally gets it from `createAuthorizationService`. */
export interface AuthorizationService {
  loadRoles(scope: string): Promise<RolesInfo>;
  loadContent(scope: string, revision?: string): Promise<AuthorizationContent>;
  saveContent(scope: string, content: AuthorizationContent): Promise<void>;
  loadDefaultContent(): Promise<AuthorizationContent>;
  loadRevisions(name: string, scope: string): Promise<Revision[]>;
  defaultName: string;
}

/**
 * Builds the calls an authorization page makes, over generic's own endpoints: `/roles` (opt-in, from
 * generic's RolesInternalController) and the single-setting endpoints for the always-present
 * `Default` setting.
 *
 * `settingName` is the feature the extension stores under - an extension may have more than one page,
 * each over its own setting.
 */
export function createAuthorizationService(sendRequest: SendRequest, settingName: string): AuthorizationService {
  const settingsPath = (suffix: string): string => `/settings/${settingName}${suffix}`;

  return {
    defaultName: DEFAULT_NAME,

    loadRoles: (scope) =>
      sendRequest({ method: 'GET', url: `/roles?scope=${encodeURIComponent(scope)}` }).then((r) =>
        jsonOrThrow<RolesInfo>(r),
      ),

    loadContent: (scope, revision) => {
      let url = settingsPath(`/names/${DEFAULT_NAME}/content?scope=${encodeURIComponent(scope)}`);
      if (revision) {
        url += `&revision=${encodeURIComponent(revision)}`;
      }
      return sendRequest({ method: 'GET', url }).then((r) => jsonOrThrow<AuthorizationContent>(r));
    },

    saveContent: (scope, content) =>
      sendRequest({
        method: 'PUT',
        url: settingsPath(`/names/${DEFAULT_NAME}/content?scope=${encodeURIComponent(scope)}`),
        contentType: 'application/json',
        body: JSON.stringify(content),
      }).then(okOrThrow),

    loadDefaultContent: () =>
      sendRequest({ method: 'GET', url: settingsPath('/default-content') }).then((r) =>
        jsonOrThrow<AuthorizationContent>(r),
      ),

    loadRevisions: (name, scope) =>
      sendRequest({
        method: 'GET',
        url: settingsPath(`/names/${encodeURIComponent(name)}/revisions?scope=${encodeURIComponent(scope)}`),
      }).then((r) => jsonOrThrow<Revision[]>(r)),
  };
}
