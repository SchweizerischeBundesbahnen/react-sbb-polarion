import type { DocEntry } from '../docs/DocsContext';
import { featureHref as defaultFeatureHref } from './docsNav';

/**
 * Keeps Polarion's own admin breadcrumb / left menu in step when a link inside one administration page
 * leads to another (e.g. a documentation article linking to another one).
 *
 * The admin shell (the top window) is hash-routed: `#/project/<id>/administration/<adminBase>/<node>`
 * (or `#/administration/<adminBase>/<node>` at repository scope). The last segment is the selected node
 * id, which is what Polarion renders the breadcrumb and highlights the menu from. The in-iframe
 * `?feature=` navigation never touches that hash, so a content link would leave the menu on the old node.
 * {@link createAdminNav} switches the top hash to the right node and carries the intended article across a
 * `sessionStorage` handoff, since selecting a node makes Polarion (re)load that node's own page.
 */

export interface PendingDoc {
  feature: string;
  hash: string;
}

export interface AdminNav {
  /** Switches the admin shell to the node serving `feature`, stashing the intended article for
   *  {@link AdminNav.resumePendingDoc}. Returns false (changing nothing) when it cannot or need not act -
   *  no node serves the feature, not embedded, a cross-origin/opaque top, an unrecognized hash, or the
   *  node is already selected - so the caller can fall back to a plain in-iframe navigation. */
  switchToFeatureNode: (feature: string, hash?: string) => boolean;
  /** Called once at startup: if a node switch stashed an intended article, navigate this frame to it and
   *  return true so the caller skips the initial render; false when there is nothing to resume. */
  resumePendingDoc: () => boolean;
}

export interface DocNodeForFeatureOptions {
  /** The documentation-site articles; each article feature maps to the single documentation node. */
  docs: DocEntry[];
  /** The admin node id every documentation article lives under. Defaults to `documentation`. */
  documentationNode?: string;
  /** Features that are their own admin node (e.g. `about`, `disclaimer`); each maps to itself. */
  selfNodes?: string[];
}

/**
 * The standard documentation-site {@link AdminNavOptions.nodeForFeature}: every documentation article maps to
 * the single documentation node, each listed self-node maps to itself, and everything else maps to null (a
 * settings page no cross-document link targets). Pass the result to {@link createAdminNav} so an extension no
 * longer hand-writes this mapping.
 */
export function docNodeForFeature(options: DocNodeForFeatureOptions): (feature: string) => string | null {
  const docIds = new Set(options.docs.map((doc) => doc.id));
  const documentationNode = options.documentationNode ?? 'documentation';
  const selfNodes = new Set(options.selfNodes ?? []);
  return (feature) => {
    if (docIds.has(feature)) {
      return documentationNode;
    }
    if (selfNodes.has(feature)) {
      return feature;
    }
    return null;
  };
}

export interface AdminNavOptions {
  /** The extension's admin context in the shell hash, e.g. `pdf-export` in
   *  `#/[project/<id>/]administration/pdf-export/<node>`. */
  adminBase: string;
  /** The admin node that serves a feature, or null when no node opens it (a plain settings page, which no
   *  cross-document link targets). */
  nodeForFeature: (feature: string) => string | null;
  /** sessionStorage key for the node-switch handoff. Defaults to `${adminBase}.docs.pending`. */
  pendingKey?: string;
  /** Builds the in-app URL selecting a feature. Defaults to the shared {@link featureHref}. */
  featureHref?: (feature: string, hash?: string) => string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * The admin hash that selects `nodeId` under `adminBase`, or null when `currentHash` is not such an
 * admin-node URL or already selects that node (nothing to change). Pure, so it is unit-tested directly.
 */
export function retargetNodeHash(currentHash: string, nodeId: string, adminBase: string): string | null {
  const re = new RegExp(`(/administration/${escapeRegExp(adminBase)}/)([^/?#]+)`);
  const match = re.exec(currentHash);
  if (!match || match[2] === nodeId) {
    return null;
  }
  return currentHash.replace(re, `$1${nodeId}`);
}

/**
 * What resume should navigate to given the stored handoff and the feature currently shown, or null when
 * there is nothing pending or it is already the current feature. Pure, so it is unit-tested directly.
 */
export function pendingTarget(raw: string | null, currentFeature: string | null): PendingDoc | null {
  if (!raw) {
    return null;
  }
  try {
    const pending = JSON.parse(raw) as Partial<PendingDoc>;
    if (pending.feature && pending.feature !== currentFeature) {
      return { feature: pending.feature, hash: pending.hash ?? '' };
    }
  } catch {
    // corrupt entry - ignore
  }
  return null;
}

/**
 * Builds the admin-shell node synchronisation for an extension, given its admin context (`adminBase`) and
 * the mapping from a feature to the admin node that serves it. Pair `switchToFeatureNode` with the
 * documentation site's `onDocLinkNavigate`, and call `resumePendingDoc` before the first render.
 */
export function createAdminNav(options: AdminNavOptions): AdminNav {
  const { adminBase, nodeForFeature } = options;
  const pendingKey = options.pendingKey ?? `${adminBase}.docs.pending`;
  const featureHref = options.featureHref ?? ((feature, hash) => defaultFeatureHref(feature, hash));

  function switchToFeatureNode(feature: string, hash = ''): boolean {
    const node = nodeForFeature(feature);
    if (!node) {
      return false;
    }
    try {
      const shell = window.top;
      if (!shell) {
        return false;
      }
      const newHash = retargetNodeHash(shell.location.hash, node, adminBase);
      if (!newHash) {
        return false;
      }
      sessionStorage.setItem(pendingKey, JSON.stringify({ feature, hash }));
      shell.location.hash = newHash;
      return true;
    } catch {
      return false; // cross-origin top or storage denied
    }
  }

  function resumePendingDoc(): boolean {
    let raw: string | null;
    try {
      raw = sessionStorage.getItem(pendingKey);
      if (raw) {
        sessionStorage.removeItem(pendingKey);
      }
    } catch {
      return false;
    }
    const currentFeature = new URLSearchParams(window.location.search).get('feature');
    const target = pendingTarget(raw, currentFeature);
    if (!target) {
      return false;
    }
    window.location.replace(featureHref(target.feature, target.hash));
    return true;
  }

  return { switchToFeatureNode, resumePendingDoc };
}
