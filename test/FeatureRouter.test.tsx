import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import FeatureRouter, { type Feature, findFeature } from '../src/components/FeatureRouter';

const origUrl = window.location.pathname + window.location.search;

const FEATURES: Feature[] = [
  { id: 'about', component: () => <div data-testid="about">About page</div> },
  { id: 'configuration', component: () => <div data-testid="configuration">Configuration page</div> },
];
const Landing = () => <div data-testid="landing">Landing</div>;

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', origUrl);
});

describe('findFeature', () => {
  it('finds by id and tolerates a null id', () => {
    expect(findFeature(FEATURES, 'configuration')?.id).toBe('configuration');
    expect(findFeature(FEATURES, 'missing')).toBeUndefined();
    expect(findFeature(FEATURES, null)).toBeUndefined();
  });
});

describe('FeatureRouter', () => {
  it('renders the component of the feature named by ?feature=', async () => {
    window.history.replaceState({}, '', '?feature=configuration&embedded=true');
    render(<FeatureRouter features={FEATURES} fallback={Landing} />);
    await vi.waitFor(() => expect(document.querySelector('[data-testid="configuration"]')).not.toBeNull());
    expect(document.querySelector('[data-testid="landing"]')).toBeNull();
  });

  it('renders the fallback when ?feature= matches nothing', async () => {
    window.history.replaceState({}, '', '?feature=nope');
    render(<FeatureRouter features={FEATURES} fallback={Landing} />);
    await vi.waitFor(() => expect(document.querySelector('[data-testid="landing"]')).not.toBeNull());
  });

  it('renders the fallback at the bare root', async () => {
    window.history.replaceState({}, '', '/');
    render(<FeatureRouter features={FEATURES} fallback={Landing} />);
    await vi.waitFor(() => expect(document.querySelector('[data-testid="landing"]')).not.toBeNull());
  });
});
