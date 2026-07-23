import { afterEach, describe, expect, it } from 'vitest';
import { getProjectIdFromScope, getScope } from '../src/services/scope';

const origUrl = window.location.pathname + window.location.search;
const setSearch = (search: string) => window.history.replaceState({}, '', search || window.location.pathname);

afterEach(() => window.history.replaceState({}, '', origUrl));

describe('getScope', () => {
  it('is empty when the scope param is absent', () => {
    setSearch('?feature=mappings');
    expect(getScope()).toBe('');
  });

  it('adds the trailing slash Polarion uses when it is missing (dev URL)', () => {
    setSearch('?scope=project/elibrary');
    expect(getScope()).toBe('project/elibrary/');
  });

  it('keeps an already-present trailing slash', () => {
    setSearch('?scope=project/elibrary/');
    expect(getScope()).toBe('project/elibrary/');
  });

  it('is empty for an empty scope value', () => {
    setSearch('?scope=');
    expect(getScope()).toBe('');
  });
});

describe('getProjectIdFromScope', () => {
  it('extracts the id from a scope with a trailing slash', () => {
    expect(getProjectIdFromScope('project/elibrary/')).toBe('elibrary');
  });

  it('extracts the id from a scope without a trailing slash', () => {
    expect(getProjectIdFromScope('project/elibrary')).toBe('elibrary');
  });

  it('returns empty for an empty or non-project (global/repository) scope', () => {
    expect(getProjectIdFromScope('')).toBe('');
    expect(getProjectIdFromScope('repository/')).toBe('');
  });
});
