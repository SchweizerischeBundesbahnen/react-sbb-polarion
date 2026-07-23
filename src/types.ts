/**
 * A saved named setting (generic settings framework: SettingName). `scope` differs from the current
 * scope when the setting is inherited from a broader (e.g. global) scope.
 */
export interface SettingName {
  name: string;
  scope: string;
}

/** One revision of a named setting (generic settings.Revision). */
export interface Revision {
  name: string;
  date?: string;
  author?: string;
  baseline?: string;
  description?: string;
}

/** Extension manifest info (generic rest.model.Version). Fields may be absent in the manifest. */
export interface Version {
  bundleName?: string;
  bundleVendor?: string;
  supportEmail?: string;
  automaticModuleName?: string;
  bundleVersion?: string;
  bundleBuildTimestamp?: string;
  projectURL?: string;
}

/** One extension configuration property (generic rest.model.ConfigurationPropertyModel). */
export interface ConfigurationProperty {
  key: string;
  value: string;
  defaultValue?: string;
  description?: string;
}

/** Active + obsolete configuration properties (generic rest.model.ConfigurationPropertiesModel). */
export interface ConfigurationPropertiesModel {
  properties: ConfigurationProperty[];
  obsoleteProperties: ConfigurationProperty[];
}

/** One configuration status entry (generic configuration.ConfigurationStatus). */
export interface ConfigurationStatus {
  name: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  details: string;
}

/**
 * Minimal REST request function the shared About / UserGuide pages call. It is a subset of an
 * extension's `useRemote().sendRequest`, so that hook's function satisfies this structurally and can
 * be passed straight in. Keeping it a prop lets the library stay free of any per-extension REST base.
 */
export type SendRequest = (options: {
  method: string;
  url: string;
  contentType?: string;
  body?: BodyInit;
}) => Promise<Response>;
