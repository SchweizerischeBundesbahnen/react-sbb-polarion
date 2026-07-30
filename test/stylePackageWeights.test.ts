import { describe, expect, it } from 'vitest';
import { createStylePackageWeightsService } from '../src/services/stylePackageWeights';
import type { SendRequest } from '../src/types';

// The two REST calls behind StylePackageWeights. The component's own suite injects a fake service, so
// this is where the URLs and the request body are pinned - they are the contract with each exporter's
// weights endpoint, and nothing else checks them. The message extraction these share with the
// authorization service is covered once, in authorizationSettings.test.ts.

/** Records every request and answers each with the next queued response. */
function recorder(...responses: Response[]) {
  const calls: { method: string; url: string; contentType?: string; body?: BodyInit }[] = [];
  const queue = [...responses];
  const sendRequest: SendRequest = (options) => {
    calls.push(options);
    return Promise.resolve(queue.shift() ?? new Response(null, { status: 204 }));
  };
  return { calls, sendRequest };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const WEIGHTS = [
  { name: 'default', scope: '', weight: 50 },
  { name: 'compact', scope: 'project/elibrary/', weight: 70 },
];

describe('createStylePackageWeightsService', () => {
  it('reads the weights of a scope, which includes the ones inherited from global', async () => {
    const { calls, sendRequest } = recorder(json(WEIGHTS));
    const service = createStylePackageWeightsService(sendRequest);

    await expect(service.loadWeights('project/elibrary/')).resolves.toEqual(WEIGHTS);
    expect(calls[0]).toMatchObject({
      method: 'GET',
      url: '/settings/style-package/weights?scope=project%2Felibrary%2F',
    });
  });

  it('reads the global scope as an empty scope parameter', async () => {
    const { calls, sendRequest } = recorder(json([]));

    await createStylePackageWeightsService(sendRequest).loadWeights('');

    expect(calls[0].url).toBe('/settings/style-package/weights?scope=');
  });

  it('writes the whole list back as JSON, with no scope in the URL', async () => {
    const { calls, sendRequest } = recorder(new Response(null, { status: 204 }));

    await createStylePackageWeightsService(sendRequest).saveWeights(WEIGHTS);

    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: '/settings/style-package/weights',
      contentType: 'application/json',
    });
    expect(JSON.parse(calls[0].body as string)).toEqual(WEIGHTS);
  });

  it('surfaces the endpoint message when a read fails', async () => {
    const { sendRequest } = recorder(json({ message: 'scope is unknown' }, 400));

    await expect(createStylePackageWeightsService(sendRequest).loadWeights('')).rejects.toThrow('scope is unknown');
  });

  it('surfaces the endpoint message when a write fails', async () => {
    const { sendRequest } = recorder(json({ errorMessage: 'read-only setting' }, 403));

    await expect(createStylePackageWeightsService(sendRequest).saveWeights(WEIGHTS)).rejects.toThrow(
      'read-only setting',
    );
  });
});
