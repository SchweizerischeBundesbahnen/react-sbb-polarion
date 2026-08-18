// Type declarations for `BreadcrumbBridge.js`, the classic script this library ships separately and
// runs in the Polarion shell window (see vite.bridge.config.ts). The runtime is plain JS with no
// imports or exports; it registers itself on the window it runs in, which is what the global
// augmentation below describes.

/** Config the bridge accepts, both through install() and as the data-* attributes on its script tag. */
export interface BreadcrumbBridgeConfig {
  /** Substring identifying the app in the URL or hash, e.g. "diff-tool". */
  marker: string;
  /** Breadcrumb title text. */
  title: string;
  /** Parent topic name; when set, renders "parent › [icon] title". */
  parent?: string;
  /** Icon URL shown left of the title. */
  icon?: string;
}

/** Handle returned by install(). */
export interface BreadcrumbBridgeHandle {
  /** Re-evaluate the current URL and mount, hide or unmount the replacement accordingly. */
  sync(): void;
  /** Re-label a live breadcrumb (e.g. when navigating between an extension's sub-topics). */
  update(config: Partial<BreadcrumbBridgeConfig>): void;
  /** Stop observing, restore Polarion's own breadcrumb and remove the replacement. */
  destroy(): void;
}

declare global {
  interface Window {
    /** Present once BreadcrumbBridge.js has run in this window. */
    SbbBreadcrumbBridge?: {
      /** Returns null when marker or title is missing, otherwise the (per-marker) handle. */
      install(config: BreadcrumbBridgeConfig): BreadcrumbBridgeHandle | null;
    };
  }
}
