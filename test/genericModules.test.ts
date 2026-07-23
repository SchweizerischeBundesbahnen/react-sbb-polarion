import { afterEach, describe, expect, it } from 'vitest';
import { configureGenericModules, getGenericModulesBase } from '../src/config/genericModules';

// configuredBase is a module singleton with no reset, so the derivation (unconfigured) cases MUST run
// before the configure cases below. window.location.pathname is driven via history.replaceState.

const origUrl = window.location.pathname + window.location.search;
const setPath = (path: string) => window.history.replaceState({}, '', path);

afterEach(() => window.history.replaceState({}, '', origUrl));

describe('genericModules base resolution', () => {
  it('derives the base from a /ui/ path when unconfigured', () => {
    setPath('/polarion/my-ext-app/ui/app/index.html');
    expect(getGenericModulesBase()).toBe('/polarion/my-ext-app/ui/generic/js/modules/');
  });

  it('falls back to /ui/generic/js/modules/ when the path has no /ui/ segment (dev at root)', () => {
    setPath('/');
    expect(getGenericModulesBase()).toBe('/ui/generic/js/modules/');
  });

  it('configureGenericModules sets the base and appends a missing trailing slash', () => {
    configureGenericModules('/polarion/my-ext-app/ui/generic/js/modules');
    expect(getGenericModulesBase()).toBe('/polarion/my-ext-app/ui/generic/js/modules/');
  });

  it('keeps an existing trailing slash, and the configured base wins over path derivation', () => {
    // The path would derive a different base, but a configured value takes precedence.
    setPath('/');
    configureGenericModules('/configured/base/');
    expect(getGenericModulesBase()).toBe('/configured/base/');
  });
});
