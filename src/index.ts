// Public entry point of the shared library. Everything a consuming extension app can import from
// `@grigoriev/react-sbb-polarion` is re-exported here. Component CSS is bundled into
// a single stylesheet consumers import once: `import '@grigoriev/react-sbb-polarion/style.css'`.
// The generic control CSS (tokens + checkboxes/radios/inputs/searchable-dropdown/buttons/alerts),
// copied from the generic framework, imported first so the --sbb-* tokens are defined before any
// component styles. This makes the library self-styled (no runtime dependency on Polarion-served CSS).
import './generic/css/controls.css';

export { default as PageLayout } from './components/PageLayout';
// One combobox for both modes: pass `multiple` for checkbox options and removable chips, which also
// switches `value` / `onChange` from a string to a string list.
export { default as SearchableSelect } from './components/SearchableSelect';
export type {
  SelectOption,
  SearchableSelectProps,
  SingleSelectProps,
  MultiSelectProps,
} from './components/SearchableSelect';
// The bundled editable (free-text) combobox factory from the vendored generic toolkit, for bespoke
// editable inputs like excel-importer's ColumnInput. Bundled (no runtime fetch), so it works in tests.
export { createEditableSelect } from './generic/searchableSelect.js';
// The bundled non-editable dropdown factory (same toolkit), for a control SearchableSelect does not
// cover: the class's build mode, its clearable (×) trigger, or a <select> that is not React-controlled.
export { createSearchableSelect } from './generic/searchableSelect.js';
export type { SearchableDropdownInstance } from './generic/searchableSelect.js';
export { default as Tabs } from './components/Tabs';
export type { TabItem } from './components/Tabs';
export { default as Modal } from './components/Modal';
// `window.confirm` as a real dialog: a promise-returning `confirm()` plus the element to render.
export { default as useConfirm } from './hooks/useConfirm';
export type { ConfirmOptions, UseConfirm } from './hooks/useConfirm';
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
// The code editor behind every settings page whose content is a document rather than a form: the DMS
// connectors' .properties configuration, the exporters' CSS, Velocity templates and HTML fragments.
// Replaces the legacy <code-input> web component; `language` picks the grammar.
export { default as CodeEditor } from './components/CodeEditor';
export type { CodeLanguage } from './components/CodeEditor';
export { default as ConfigurationButtons } from './components/ConfigurationButtons';
// The role-checkbox administration page (xml-repair, api-extender, diff-tool): global and project
// roles as checkboxes over one named setting, with the standard toolbar and revisions. Pair it with
// createAuthorizationService, which builds the calls over generic's own endpoints.
export { default as AuthorizationSettings } from './components/AuthorizationSettings';
export { createAuthorizationService } from './services/authorizationSettings';
// The exporters' style-package ordering page: a weighted, reorderable list where higher weight means
// higher position. Shared here rather than per extension - it was already one class in generic, driven
// by each exporter's own weights endpoint, which is what createStylePackageWeightsService builds.
export { default as StylePackageWeights } from './components/StylePackageWeights';
export type { WeightEntry } from './components/StylePackageWeights';
export { createStylePackageWeightsService } from './services/stylePackageWeights';
export type { StylePackageWeight, StylePackageWeightsService } from './services/stylePackageWeights';
export type { AuthorizationContent, AuthorizationService, RolesInfo } from './services/authorizationSettings';
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
