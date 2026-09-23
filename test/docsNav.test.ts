import { describe, expect, it } from 'vitest';
import { docLinkTarget, featureHref, parseDocLink } from '../src/services/docsNav';

// Pure navigation helpers for the documentation site. Location is injected so the assertions do not
// depend on the test page's own URL.

const loc = {
  pathname: '/polarion/pdf-exporter-app/ui/app/index.html',
  search: '?embedded=true&scope=project%2Felibrary%2F',
};

describe('featureHref', () => {
  it('selects a feature while preserving the other params and carrying the fragment', () => {
    const href = featureHref('upgrade', '#weasyprint-configuration', loc);
    const [path, rest] = href.split('?');
    expect(path).toBe('/polarion/pdf-exporter-app/ui/app/index.html');
    const [query, hash] = rest.split('#');
    const params = new URLSearchParams(query);
    expect(params.get('feature')).toBe('upgrade');
    expect(params.get('embedded')).toBe('true');
    expect(params.get('scope')).toBe('project/elibrary/');
    expect(hash).toBe('weasyprint-configuration');
  });

  it('omits the fragment when none is given', () => {
    expect(featureHref('configuration', '', { pathname: '/app/index.html', search: '' })).toBe(
      '/app/index.html?feature=configuration',
    );
  });
});

describe('docLinkTarget', () => {
  it('maps a cross-document .html link to a feature URL', () => {
    expect(docLinkTarget('configuration.html', { pathname: '/app/index.html', search: '' })).toBe(
      '/app/index.html?feature=configuration',
    );
    const target = docLinkTarget('upgrade.html#weasyprint-configuration', loc) ?? '';
    expect(target).toContain('feature=upgrade');
    expect(target.endsWith('#weasyprint-configuration')).toBe(true);
  });

  it('returns null for links that are not cross-document articles', () => {
    expect(docLinkTarget('https://example.com/x.html', loc)).toBeNull();
    expect(docLinkTarget('#weasyprint-configuration', loc)).toBeNull();
    expect(docLinkTarget('docs/openapi.json', loc)).toBeNull();
    expect(docLinkTarget(null, loc)).toBeNull();
  });
});

describe('parseDocLink', () => {
  it('splits a doc link into feature and fragment', () => {
    expect(parseDocLink('configuration.html#bulk-processing-api-key')).toEqual({
      feature: 'configuration',
      hash: '#bulk-processing-api-key',
    });
    expect(parseDocLink('quick-start.html')).toEqual({ feature: 'quick-start', hash: '' });
  });

  it('returns null for non-doc links', () => {
    expect(parseDocLink('x.png')).toBeNull();
    expect(parseDocLink('#anchor')).toBeNull();
    expect(parseDocLink(null)).toBeNull();
  });
});
