// Public entry point of the shared library. Everything a consuming extension app can import from
// `@grigoriev/react-sbb-polarion` is re-exported here. Component CSS is bundled into
// a single stylesheet consumers import once: `import '@grigoriev/react-sbb-polarion/style.css'`.
// The generic control CSS (tokens + checkboxes/radios/inputs/searchable-dropdown/buttons/alerts),
// copied from the generic framework, imported first so the --sbb-* tokens are defined before any
// component styles. This makes the library self-styled (no runtime dependency on Polarion-served CSS).
import './generic/css/controls.css';

export { default as PageLayout } from './components/PageLayout';
export { default as SearchableSelect } from './components/SearchableSelect';
export type { SelectOption } from './components/SearchableSelect';
// The bundled editable (free-text) combobox factory from the vendored generic toolkit, for bespoke
// editable inputs like excel-importer's ColumnInput. Bundled (no runtime fetch), so it works in tests.
export { createEditableSelect } from './generic/searchableSelect.js';
// The bundled non-editable dropdown factory (same toolkit), for a bespoke controlled <select> that
// needs richer options than SearchableSelect's { id, name } - e.g. xml-repair's entity-type combobox
// with per-option icons and indented subtypes (data-icon / data-icon-bg attributes + preserveOptionClasses).
export { createSearchableSelect } from './generic/searchableSelect.js';
export type { SearchableDropdownInstance } from './generic/searchableSelect.js';
export { default as Modal } from './components/Modal';
// Shared app-wide toast host (sonner, preconfigured: top-center + richColors + 5s). Mount once near the
// app root; fire toasts with `toast()` from `sonner`. sonner is a peer dependency (not bundled).
export { default as Toaster } from './components/Toaster';
export { default as BreadcrumbInjector } from './components/BreadcrumbInjector';
export { default as RestAuthTest } from './components/RestAuthTest';
export { default as About } from './components/About';
export { default as UserGuide } from './components/UserGuide';
export { ConfigurationsPane } from './components/ConfigurationsPane';
export type { ConfigurationsPaneHandle, ConfigurationsService } from './components/ConfigurationsPane';
export { default as RevisionsTable } from './components/RevisionsTable';
// The .properties editor for settings pages whose whole configuration is one properties document
// (the DMS connectors). Replaces the legacy <code-input lang="properties"> web component.
export { default as PropertiesEditor, tokenizePropertiesLine } from './components/PropertiesEditor';
export { default as ConfigurationButtons } from './components/ConfigurationButtons';
export { configureGenericModules } from './config/genericModules';
export { getCookie, setCookie } from './services/cookies';
export { isEmbedded } from './services/params';
export { getScope, getProjectIdFromScope } from './services/scope';
export type {
  SettingName,
  Revision,
  Version,
  ConfigurationProperty,
  ConfigurationPropertiesModel,
  ConfigurationStatus,
  SendRequest,
} from './types';
