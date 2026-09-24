import type { ComponentType } from 'react';

/** One navigable page of a single-bundle admin app, selected by `?feature=<id>`. Extensions may carry
 *  extra fields (label, description, ...); only `id` and `component` are needed to route. */
export interface Feature {
  id: string;
  component: ComponentType;
}

/** The feature with the given id, or undefined. */
export function findFeature<F extends Feature>(features: F[], id: string | null): F | undefined {
  return features.find((feature) => feature.id === id);
}

interface FeatureRouterProps {
  /** All navigable pages of the app. */
  features: Feature[];
  /** Rendered when `?feature=` matches nothing (including the bare root) - typically a dev landing stub. */
  fallback: ComponentType;
}

/**
 * Picks the page to render from the `?feature=<id>` query parameter - the router of a single-bundle admin
 * app (one index.html; Polarion opens each page with `?feature=<id>&embedded=true&scope=$scope$`). The
 * consuming app wraps this in whatever chrome/providers it needs (Toaster, DocsProvider, ...).
 */
export default function FeatureRouter({ features, fallback: Fallback }: Readonly<FeatureRouterProps>) {
  const match = findFeature(features, new URLSearchParams(window.location.search).get('feature'));
  const Page = match ? match.component : Fallback;
  return <Page />;
}
