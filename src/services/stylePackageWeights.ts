import type { SendRequest } from '../types';
import { jsonOrThrow, okOrThrow } from './rest';

/**
 * One style package's weight, as the exporters' `settings/style-package/weights` endpoint speaks it
 * (`StylePackageWeightInfo` on the Java side).
 */
export interface StylePackageWeight {
  name: string;
  /** Scope the package is defined in; `''` is the global scope. */
  scope: string;
  weight: number;
}

/** What {@link StylePackageWeights} needs; an extension normally gets it from `createStylePackageWeightsService`. */
export interface StylePackageWeightsService {
  loadWeights(scope: string): Promise<StylePackageWeight[]>;
  saveWeights(weights: StylePackageWeight[]): Promise<void>;
}

/**
 * Builds the two calls the weights page makes. The endpoint is the extension's own (each exporter
 * administers its own style packages), which is why the page takes the service rather than building
 * the URLs itself - `sendRequest` already carries the extension's REST base.
 *
 * There is deliberately no default or revisions call: the controller exposes only GET and POST on this
 * path, which is why the page's toolbar is Save / Cancel alone.
 */
export function createStylePackageWeightsService(sendRequest: SendRequest): StylePackageWeightsService {
  const path = '/settings/style-package/weights';

  return {
    loadWeights: (scope) =>
      sendRequest({ method: 'GET', url: `${path}?scope=${encodeURIComponent(scope)}` }).then((r) =>
        jsonOrThrow<StylePackageWeight[]>(r),
      ),

    saveWeights: (weights) =>
      sendRequest({
        method: 'POST',
        url: path,
        contentType: 'application/json',
        body: JSON.stringify(weights),
      }).then(okOrThrow),
  };
}
