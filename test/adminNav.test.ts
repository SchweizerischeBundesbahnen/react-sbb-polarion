import { describe, expect, it, vi } from 'vitest';
import { createAdminNav, docNodeForFeature, pendingTarget, retargetNodeHash } from '../src/services/adminNav';

const DOCS = [
  { id: 'quick-start', title: 'Quick Start', source: 'QUICK_START.md' },
  { id: 'user-guide', title: 'User Guide', source: 'USER_GUIDE.md' },
  { id: 'configuration', title: 'Configuration', source: 'CONFIGURATION.md' },
];

// Pure logic of the admin-shell node switching, plus the factory's no-op branch. The DOM-touching
// wrappers drive real Polarion frames end-to-end, not here.

describe('retargetNodeHash', () => {
  const base = 'pdf-export';

  it('rewrites the selected node segment (project scope)', () => {
    expect(retargetNodeHash('#/project/elibrary/administration/pdf-export/about', 'documentation', base)).toBe(
      '#/project/elibrary/administration/pdf-export/documentation',
    );
  });

  it('rewrites the selected node segment (repository scope)', () => {
    expect(retargetNodeHash('#/administration/pdf-export/disclaimer', 'documentation', base)).toBe(
      '#/administration/pdf-export/documentation',
    );
  });

  it('is parameterised by the admin base', () => {
    expect(retargetNodeHash('#/administration/docx-export/about', 'documentation', 'docx-export')).toBe(
      '#/administration/docx-export/documentation',
    );
    // a different base does not match
    expect(retargetNodeHash('#/administration/docx-export/about', 'documentation', 'pdf-export')).toBeNull();
  });

  it('returns null when already on that node or the hash is not an admin-node URL', () => {
    expect(retargetNodeHash('#/administration/pdf-export/documentation', 'documentation', base)).toBeNull();
    expect(retargetNodeHash('#/project/x/workitems', 'documentation', base)).toBeNull();
    expect(retargetNodeHash('', 'documentation', base)).toBeNull();
  });
});

describe('pendingTarget', () => {
  it('returns the stashed article when it differs from the current feature', () => {
    const raw = JSON.stringify({ feature: 'configuration', hash: '#weasyprint-configuration' });
    expect(pendingTarget(raw, 'quick-start')).toEqual({ feature: 'configuration', hash: '#weasyprint-configuration' });
  });

  it('defaults a missing hash to empty', () => {
    expect(pendingTarget(JSON.stringify({ feature: 'upgrade' }), 'quick-start')).toEqual({
      feature: 'upgrade',
      hash: '',
    });
  });

  it('returns null when nothing is pending, already there, or corrupt', () => {
    expect(pendingTarget(null, 'quick-start')).toBeNull();
    expect(pendingTarget(JSON.stringify({ feature: 'configuration' }), 'configuration')).toBeNull();
    expect(pendingTarget('not json', 'quick-start')).toBeNull();
  });

  it('resumes on a fragment change even when the feature is unchanged (self-node / landing article)', () => {
    const raw = JSON.stringify({ feature: 'disclaimer', hash: '#section' });
    // same feature, but the page arrived without the fragment -> still resume so it scrolls
    expect(pendingTarget(raw, 'disclaimer', '')).toEqual({ feature: 'disclaimer', hash: '#section' });
    // both feature and fragment already match -> nothing to do
    expect(pendingTarget(raw, 'disclaimer', '#section')).toBeNull();
  });
});

describe('createAdminNav', () => {
  it('does not switch (nor touch storage) when no node serves the feature', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const nav = createAdminNav({ adminBase: 'pdf-export', nodeForFeature: () => null });
    expect(nav.switchToFeatureNode('css', '#x')).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('resumePendingDoc returns false when nothing is stashed', () => {
    const nav = createAdminNav({ adminBase: 'pdf-export', nodeForFeature: (f) => f });
    sessionStorage.removeItem('pdf-export.docs.pending');
    expect(nav.resumePendingDoc()).toBe(false);
  });
});

describe('docNodeForFeature', () => {
  it('maps every documentation article to the single documentation node', () => {
    const nodeForFeature = docNodeForFeature({ docs: DOCS, selfNodes: ['about', 'disclaimer'] });
    for (const doc of DOCS) {
      expect(nodeForFeature(doc.id)).toBe('documentation');
    }
  });

  it('maps each self-node to itself and everything else to null', () => {
    const nodeForFeature = docNodeForFeature({ docs: DOCS, selfNodes: ['about', 'disclaimer'] });
    expect(nodeForFeature('about')).toBe('about');
    expect(nodeForFeature('disclaimer')).toBe('disclaimer');
    expect(nodeForFeature('authorization')).toBeNull();
    expect(nodeForFeature('css')).toBeNull();
  });

  it('honours a custom documentation node id and empty self-nodes', () => {
    const nodeForFeature = docNodeForFeature({ docs: DOCS, documentationNode: 'help' });
    expect(nodeForFeature('quick-start')).toBe('help');
    expect(nodeForFeature('about')).toBeNull();
  });
});
