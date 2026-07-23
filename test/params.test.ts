import { afterEach, describe, expect, it } from 'vitest';
import { isEmbedded } from '../src/services/params';

// isEmbedded reads window.location.search; drive it with history.replaceState (no navigation), and
// restore the bare path afterwards.

const origUrl = window.location.pathname + window.location.search;
const setSearch = (search: string) => window.history.replaceState({}, '', search || window.location.pathname);

afterEach(() => window.history.replaceState({}, '', origUrl));

describe('isEmbedded', () => {
  it('is false when the embedded param is absent', () => {
    setSearch('?feature=about');
    expect(isEmbedded()).toBe(false);
  });

  it('is true only for embedded=true', () => {
    setSearch('?embedded=true');
    expect(isEmbedded()).toBe(true);
  });

  it('is false for embedded=false or other truthy-looking values', () => {
    setSearch('?embedded=false');
    expect(isEmbedded()).toBe(false);
    setSearch('?embedded=1');
    expect(isEmbedded()).toBe(false);
    setSearch('?embedded=TRUE');
    expect(isEmbedded()).toBe(false);
  });

  it('is false when there is no query string', () => {
    setSearch('');
    expect(isEmbedded()).toBe(false);
  });
});
