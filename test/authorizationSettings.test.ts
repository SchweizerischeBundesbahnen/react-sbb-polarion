import { describe, expect, it } from 'vitest';
import { createAuthorizationService } from '../src/services/authorizationSettings';
import type { SendRequest } from '../src/types';

// The REST calls behind AuthorizationSettings. The component's own suite injects a fake service, so
// this is where the URLs, the request bodies and the error-message extraction are actually pinned -
// they are the contract with generic's endpoints, and nothing else checks them.

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

const ROLES = { globalRoles: ['admin'], projectRoles: ['project_admin'] };
const CONTENT = { globalRoles: ['admin'], projectRoles: [] };

describe('createAuthorizationService', () => {
  it('names the single always-present setting the generic framework uses', () => {
    expect(createAuthorizationService(recorder().sendRequest, 'authorization').defaultName).toBe('Default');
  });

  it('reads the roles of a scope from generic /roles endpoint', async () => {
    const { calls, sendRequest } = recorder(json(ROLES));
    const service = createAuthorizationService(sendRequest, 'authorization');

    await expect(service.loadRoles('project/elibrary/')).resolves.toEqual(ROLES);
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/roles?scope=project%2Felibrary%2F' });
  });

  it('reads the stored content of its own setting', async () => {
    const { calls, sendRequest } = recorder(json(CONTENT));
    const service = createAuthorizationService(sendRequest, 'project_custom_fields');

    await expect(service.loadContent('project/elibrary/')).resolves.toEqual(CONTENT);
    expect(calls[0].url).toBe('/settings/project_custom_fields/names/Default/content?scope=project%2Felibrary%2F');
  });

  it('asks for a specific revision when one is given', async () => {
    const { calls, sendRequest } = recorder(json(CONTENT));
    const service = createAuthorizationService(sendRequest, 'authorization');

    await service.loadContent('', '4321');
    expect(calls[0].url).toBe('/settings/authorization/names/Default/content?scope=&revision=4321');
  });

  it('writes the content back as JSON', async () => {
    const { calls, sendRequest } = recorder(new Response(null, { status: 204 }));
    const service = createAuthorizationService(sendRequest, 'authorization');

    await expect(service.saveContent('project/elibrary/', CONTENT)).resolves.toBeUndefined();
    expect(calls[0]).toMatchObject({
      method: 'PUT',
      url: '/settings/authorization/names/Default/content?scope=project%2Felibrary%2F',
      contentType: 'application/json',
    });
    expect(JSON.parse(String(calls[0].body))).toEqual(CONTENT);
  });

  it('reads the bundle default, which has no scope of its own', async () => {
    const { calls, sendRequest } = recorder(json({ globalRoles: [], projectRoles: [] }));
    const service = createAuthorizationService(sendRequest, 'authorization');

    await expect(service.loadDefaultContent()).resolves.toEqual({ globalRoles: [], projectRoles: [] });
    expect(calls[0].url).toBe('/settings/authorization/default-content');
  });

  it('lists revisions, encoding a setting name that needs it', async () => {
    const revisions = [{ name: '4321', date: '2026-01-01', author: 'jdoe' }];
    const { calls, sendRequest } = recorder(json(revisions));
    const service = createAuthorizationService(sendRequest, 'authorization');

    await expect(service.loadRevisions('My Setting', 'project/elibrary/')).resolves.toEqual(revisions);
    expect(calls[0].url).toBe('/settings/authorization/names/My%20Setting/revisions?scope=project%2Felibrary%2F');
  });
});

describe('createAuthorizationService error reporting', () => {
  // Each shape drives a different branch of the message extraction, and what survives is what the page
  // shows the user in a toast - so a wrong branch is a wrong message, not a crash.
  const failures: [name: string, response: () => Response, expected: string][] = [
    ['generic message field', () => json({ message: 'read-only setting' }, 403), 'read-only setting'],
    ['errorMessage field', () => json({ errorMessage: 'scope is unknown' }, 400), 'scope is unknown'],
    // Parsed fine but carries neither known field: nothing here is fit to show, so the status is it.
    ['a JSON body with neither field', () => json({ detail: 'nope' }, 400), 'HTTP 400'],
    ['a body that is not JSON', () => new Response('gateway blew up', { status: 502 }), 'gateway blew up'],
    ['no body at all', () => new Response('', { status: 503 }), 'HTTP 503'],
  ];

  it.each(failures)('surfaces a failed read carrying %s', async (_name, response, expected) => {
    const service = createAuthorizationService(recorder(response()).sendRequest, 'authorization');
    await expect(service.loadContent('')).rejects.toThrow(expected);
  });

  it.each(failures)('surfaces a failed write carrying %s', async (_name, response, expected) => {
    const service = createAuthorizationService(recorder(response()).sendRequest, 'authorization');
    await expect(service.saveContent('', CONTENT)).rejects.toThrow(expected);
  });

  it('falls back to the status when the body cannot even be read', async () => {
    // A response whose body has already been consumed rejects on .text(); the message must still say
    // something rather than propagate that failure.
    const consumed = json({ message: 'never seen' }, 500);
    await consumed.text();

    const service = createAuthorizationService(recorder(consumed).sendRequest, 'authorization');
    await expect(service.loadRoles('')).rejects.toThrow('HTTP 500');
  });
});
