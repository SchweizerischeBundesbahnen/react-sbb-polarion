import { type ReactNode, createContext, useContext, useMemo } from 'react';
import { featureHref as defaultFeatureHref } from '../services/docsNav';

/** One documentation article: its feature id, display title and (optional) markdown source filename. */
export interface DocEntry {
  id: string;
  title: string;
  /** The repo-root markdown file the article is generated from, e.g. `CONFIGURATION.md`. Used only for
   *  the "not generated" fallback link. */
  source?: string;
}

/** One searchable section of an article, as emitted by the build's section index. */
export interface DocSearchRecord {
  doc: string;
  docTitle: string;
  anchor: string;
  title: string;
  text: string;
}

/** What a consuming extension supplies to drive the documentation site. Only `docs` is required. */
export interface DocsConfig {
  /** Every article in reading order - the order the sidebar lists and prev/next follows. */
  docs: DocEntry[];
  /** The build-generated search index (one record per section). Search is disabled when omitted. */
  searchIndex?: DocSearchRecord[];
  /** Builds an in-app URL selecting a feature. Defaults to a `?feature=<id>` link preserving the other
   *  query params. */
  featureHref?: (feature: string, hash?: string) => string;
  /** Where a doc article's HTML is fetched from. Defaults to `../../html/<name>.html` relative to the app. */
  articleHtmlUrl?: (name: string) => string;
  /** Base URL (e.g. the GitHub repo blob root) for the "article not generated" fallback link to the source,
   *  and for content links that resolve to a repo file rather than a feature (e.g. docs/openapi.json). */
  sourceBaseUrl?: string;
  /** Maps a markdown source filename (e.g. `CONFIGURATION.md`) to the feature id that renders it, so the
   *  interceptor can turn the articles' cross-document `.md` links into in-app feature navigation. */
  mdLinkMap?: Record<string, string>;
  /** The breadcrumb's root label. Defaults to "Documentation". */
  breadcrumbRootLabel?: string;
  /** The article the breadcrumb root links to. Defaults to the first article in `docs`. */
  breadcrumbLandingId?: string;
  /** Optional hook the doc-link interceptor calls before falling back to a plain in-frame navigation; return
   *  true when it handled the navigation (e.g. an extension synced Polarion's admin shell). */
  onDocLinkNavigate?: (feature: string, hash: string) => boolean;
}

/** Options for {@link buildDocsConfig}: a {@link DocsConfig} minus `mdLinkMap` (assembled from the manifest)
 *  plus the non-article markdown links to fold in. */
export interface BuildDocsConfigOptions extends Omit<DocsConfig, 'mdLinkMap'> {
  /** Markdown sources that are not documentation articles but still resolve to a feature, e.g.
   *  `{ 'README.md': 'about', 'DISCLAIMER.md': 'disclaimer' }`. */
  extraMdLinks?: Record<string, string>;
}

/**
 * Assembles a {@link DocsConfig}, building `mdLinkMap` from each article's markdown `source` (source -> id)
 * plus any `extraMdLinks`, so a cross-document `.md` link resolves to the feature that renders it. Every other
 * field is passed through unchanged (defaults are applied by {@link DocsProvider}). Lets an extension supply
 * only its data - `docs`, `searchIndex`, `sourceBaseUrl`, the About/Disclaimer extras and the nav hook -
 * instead of restating the same mdLinkMap shape.
 */
export function buildDocsConfig({ extraMdLinks, ...config }: BuildDocsConfigOptions): DocsConfig {
  return {
    ...config,
    mdLinkMap: {
      ...extraMdLinks,
      ...Object.fromEntries(config.docs.filter((doc) => doc.source).map((doc) => [doc.source as string, doc.id])),
    },
  };
}

/** The resolved config the components read, with defaults applied and lookups derived. */
interface DocsContextValue extends Required<Omit<DocsConfig, 'onDocLinkNavigate' | 'sourceBaseUrl'>> {
  sourceBaseUrl?: string;
  onDocLinkNavigate?: (feature: string, hash: string) => boolean;
  byId: Record<string, DocEntry>;
  neighbours: (id: string) => { prev: DocEntry | null; next: DocEntry | null };
}

const DocsContext = createContext<DocsContextValue | null>(null);

/**
 * Provides the documentation-site configuration to {@link DocLayout} and its parts. Wrap the documentation
 * pages (or the whole admin app) in it once.
 */
export function DocsProvider({ config, children }: Readonly<{ config: DocsConfig; children: ReactNode }>) {
  const value = useMemo<DocsContextValue>(() => {
    const docs = config.docs;
    const byId = Object.fromEntries(docs.map((doc) => [doc.id, doc]));
    return {
      docs,
      byId,
      searchIndex: config.searchIndex ?? [],
      featureHref: config.featureHref ?? ((feature, hash) => defaultFeatureHref(feature, hash)),
      articleHtmlUrl:
        config.articleHtmlUrl ?? ((name) => new URL(`../../html/${name}.html`, window.location.href).href),
      sourceBaseUrl: config.sourceBaseUrl,
      mdLinkMap: config.mdLinkMap ?? {},
      breadcrumbRootLabel: config.breadcrumbRootLabel ?? 'Documentation',
      breadcrumbLandingId: config.breadcrumbLandingId ?? docs[0]?.id ?? '',
      onDocLinkNavigate: config.onDocLinkNavigate,
      neighbours: (id: string) => {
        const index = docs.findIndex((doc) => doc.id === id);
        if (index < 0) {
          return { prev: null, next: null };
        }
        return {
          prev: index > 0 ? docs[index - 1] : null,
          next: index < docs.length - 1 ? docs[index + 1] : null,
        };
      },
    };
  }, [config]);

  return <DocsContext.Provider value={value}>{children}</DocsContext.Provider>;
}

/** Reads the documentation-site config; throws when used outside a {@link DocsProvider}. */
export function useDocs(): DocsContextValue {
  const value = useContext(DocsContext);
  if (!value) {
    throw new Error('useDocs must be used within a DocsProvider');
  }
  return value;
}
