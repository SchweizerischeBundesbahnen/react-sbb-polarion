// Type declarations for `DleToolbarStarter.js`, the classic script this library ships separately and
// an extension's starter.js loads into the Polarion document editor (see vite.toolbar.config.ts). The
// runtime registers itself on the window it runs in and keeps its cross-instance state on `top`, which
// is what the global augmentation below describes.

/** Which Polarion toolbar to inject into. */
export type DleToolbarTarget = 'dleEditor' | 'richPagePreview';

/**
 * SECURITY: `html` is written via innerHTML into the top Polarion frame, so it must be static,
 * trusted markup. Never interpolate user-controlled data into it unsanitized. The same holds for
 * `onClick` below, which becomes an onclick attribute.
 */
export interface DleToolbarConfig {
  /** Unique id set on the injected element; also the idempotency and dedup key. */
  markerId: string;
  /** Markup injected into the toolbar row. */
  html: string;
  /** Defaults to 'dleEditor'. */
  target?: DleToolbarTarget;
  /** Fallback left-to-right order, used only when the inject script's DOM position cannot be read. */
  order?: number;
  /** URL GETed for a `{ permitted: boolean }` JSON verdict. Fail-closed. */
  permissionCheckUrl?: string;
  /** Takes precedence over permissionCheckUrl. Fail-closed. */
  permissionCheck?: () => boolean | Promise<boolean>;
}

export interface DleToolbarInjectParams {
  /** Inject in the disabled state. */
  disabled?: boolean;
}

/** The one call an extension needs for a standard document-editor toolbar button. */
export interface DleToolbarButtonConfig {
  /** The extension's web-context segment, e.g. 'pdf-exporter'. Drives the marker id and ordering. */
  marker: string;
  /** Tooltip and image alt text. */
  title: string;
  /** The button icon. */
  iconUrl: string;
  /** JavaScript for the button's onclick attribute. Trusted, static code only. */
  onClick: string;
  /** Endpoint returning `{ permitted: boolean }`; the current project is appended automatically. */
  permissionUrl?: string;
  /** Fallback order, used only when the inject script's DOM position cannot be read. */
  order?: number;
}

export interface DleToolbarStarterHandle {
  /** Inject (idempotently) and arm the self-healing observer. Params are merged across calls. */
  injectToolbar(params?: DleToolbarInjectParams): void;
  /** Toggle the disabled state on the live button and for future re-injects. */
  setDisabled(disabled: boolean): void;
  /** Stop self-healing, release the observer and clear the disabled state. */
  destroy(): void;
}

declare global {
  interface Window {
    /** Present once DleToolbarStarter.js has run in this window. */
    CommonDleToolbarStarter?: {
      /** Build the standard button, resolve its permission endpoint and inject it. */
      addButton(config: DleToolbarButtonConfig): DleToolbarStarterHandle;
      /** Low-level: inject caller-supplied markup. Use addButton() unless the markup must differ. */
      create(config: DleToolbarConfig): DleToolbarStarterHandle;
      /** The standard button markup, exposed for callers that assemble their own container. */
      buildButtonHtml(config: Omit<DleToolbarButtonConfig, 'marker' | 'permissionUrl' | 'order'>): string;
      /** Keep the Rich Page tools toolbar expanded. Idempotent across callers. */
      autoExpandRichPageTools(): void;
      injectStyles(id: string, href: string): void;
      injectScript(id: string, src: string, type?: string): void;
      /** Inject the bundled toolbar-button styles into the top frame. Idempotent. */
      injectOwnStyles(): void;
    };
    // The four registries below keep their original `__generic*` names on purpose: they are shared
    // with generic's older engine so old and new extensions still coordinate on one page. See the
    // NAMING note in DleToolbarStarter.js before renaming any of them.
    /** Live self-healing observers by markerId, kept on `top` so they survive a re-load. */
    __genericDleToolbarObservers?: Record<string, MutationObserver>;
    /** Resolved left-to-right order by markerId. */
    __genericDleToolbarOrder?: Record<string, number>;
    /** Current owning starter instance by markerId. */
    __genericDleToolbarOwners?: Record<string, object>;
    /** The single shared auto-expand observer. */
    __genericRpeAutoExpandObserver?: MutationObserver;
  }
}
