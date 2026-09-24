import { describe, expect, it } from 'vitest';
import { buildDocsConfig } from '../src/docs/DocsContext';

const DOCS = [
  { id: 'quick-start', title: 'Quick Start', source: 'QUICK_START.md' },
  { id: 'user-guide', title: 'User Guide', source: 'USER_GUIDE.md' },
  { id: 'configuration', title: 'Configuration', source: 'CONFIGURATION.md' },
];

describe('buildDocsConfig', () => {
  it('builds mdLinkMap from each article source plus the extra links', () => {
    const config = buildDocsConfig({
      docs: DOCS,
      sourceBaseUrl: 'https://github.com/example/repo/blob/main',
      extraMdLinks: { 'README.md': 'about', 'DISCLAIMER.md': 'disclaimer' },
    });
    expect(config.mdLinkMap).toEqual({
      'README.md': 'about',
      'DISCLAIMER.md': 'disclaimer',
      'QUICK_START.md': 'quick-start',
      'USER_GUIDE.md': 'user-guide',
      'CONFIGURATION.md': 'configuration',
    });
    // pass-through fields are preserved and extraMdLinks is not leaked onto the config
    expect(config.sourceBaseUrl).toBe('https://github.com/example/repo/blob/main');
    expect(config.docs).toBe(DOCS);
    expect('extraMdLinks' in config).toBe(false);
  });

  it('an article source overrides an extra link of the same name', () => {
    const config = buildDocsConfig({
      docs: [{ id: 'readme', title: 'Readme', source: 'README.md' }],
      extraMdLinks: { 'README.md': 'about' },
    });
    expect(config.mdLinkMap?.['README.md']).toBe('readme');
  });

  it('skips articles without a markdown source', () => {
    const config = buildDocsConfig({ docs: [{ id: 'welcome', title: 'Welcome' }] });
    expect(config.mdLinkMap).toEqual({});
  });
});
