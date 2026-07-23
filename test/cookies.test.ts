import { afterEach, describe, expect, it } from 'vitest';
import { getCookie, setCookie } from '../src/services/cookies';

// Behavior tests for the cookie helpers. document.cookie is real in the browser runner, so these
// exercise the actual encode/decode + lookup, not a jsdom shim.

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

afterEach(clearCookies);

describe('cookies', () => {
  it('round-trips a value through setCookie / getCookie', () => {
    setCookie('pref', 'hello');
    expect(getCookie('pref')).toBe('hello');
  });

  it('returns null for a cookie that is not set', () => {
    expect(getCookie('missing')).toBeNull();
  });

  it('encodes and decodes special characters (spaces, ; and =)', () => {
    setCookie('weird', 'a b;c=d');
    // Stored URL-encoded so the ; does not split the cookie; getCookie decodes it back.
    expect(document.cookie).toContain('weird=a%20b%3Bc%3Dd');
    expect(getCookie('weird')).toBe('a b;c=d');
  });

  it('reads the correct cookie when several are set', () => {
    setCookie('a', '1');
    setCookie('b', '2');
    setCookie('c', '3');
    expect(getCookie('a')).toBe('1');
    expect(getCookie('b')).toBe('2');
    expect(getCookie('c')).toBe('3');
  });

  it('does not match a cookie whose name is a prefix of the requested one', () => {
    setCookie('abc', 'x');
    expect(getCookie('ab')).toBeNull();
  });
});
