import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { a11yViolations, pageViolations } from '../src/testing';

// The helper the extensions import as `@sbb-polarion/react-sbb-polarion/testing`. The component suites only
// ever see it return nothing, so this checks what a violation looks like and what the options change.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.classList.remove('sbb-ui');
});

// An input with no name of any kind: axe's `label` rule, one of the WCAG A rules the helper runs.
// render() commits asynchronously, so the scan waits for the element.
async function unnamed() {
  render(
    <div data-testid="scope">
      <input type="text" className="unnamed" />
    </div>,
  );
  await vi.waitFor(() => expect(document.querySelector('.unnamed')).not.toBeNull());
}

describe('a11yViolations', () => {
  it('reports a violation with its rule, impact, help text and the element it concerns', async () => {
    await unnamed();
    const violations = await a11yViolations(document.querySelector('[data-testid="scope"]')!);
    expect(violations.map((v) => v.rule)).toEqual(['label']);
    expect(violations[0].impact).toBe('critical');
    expect(violations[0].help).toBe('Form elements must have labels');
    expect(violations[0].targets).toHaveLength(1);
    expect(violations[0].targets[0]).toMatch(/^input :: Fix any of the following/);
  });

  it('checks the whole document when given no context', async () => {
    await unnamed();
    expect((await a11yViolations()).map((v) => v.rule)).toEqual(['label']);
  });

  it('leaves out the subtrees named in `exclude`', async () => {
    await unnamed();
    expect(await a11yViolations(document, { exclude: ['.unnamed'] })).toEqual([]);
  });

  it('does not report color contrast or target size, which are excluded on purpose', async () => {
    render(
      <div data-testid="scope" style={{ background: '#ffffff' }}>
        <p style={{ color: '#eeeeee' }}>faint text</p>
        {/* Two small targets side by side: a lone one would pass through the rule's spacing exception. */}
        <button type="button" style={{ width: 8, height: 8, padding: 0, margin: 0 }} aria-label="Tiny" />
        <button type="button" style={{ width: 8, height: 8, padding: 0, margin: 0 }} aria-label="Tiny too" />
      </div>,
    );
    await vi.waitFor(() => expect(document.querySelector('[aria-label="Tiny too"]')).not.toBeNull());
    const scope = document.querySelector('[data-testid="scope"]')!;
    // The fixture does break both rules, so the empty result below is the exclusion at work.
    const direct = await axe.run(scope, { runOnly: { type: 'rule', values: ['color-contrast', 'target-size'] } });
    expect(direct.violations.map((v) => v.id).sort()).toEqual(['color-contrast', 'target-size']);
    expect(await a11yViolations(scope)).toEqual([]);
  });
});

describe('pageViolations', () => {
  /** Records whether <body> carried .sbb-ui at the moment axe ran. */
  function spyOnScan(): { sbbUiDuringScan: boolean[] } {
    const seen = { sbbUiDuringScan: [] as boolean[] };
    const run = axe.run.bind(axe);
    vi.spyOn(axe, 'run').mockImplementation(((...args: Parameters<typeof axe.run>) => {
      seen.sbbUiDuringScan.push(document.body.classList.contains('sbb-ui'));
      return run(...args);
    }) as typeof axe.run);
    return seen;
  }

  it('reports the violations of the whole page', async () => {
    await unnamed();
    expect((await pageViolations()).map((v) => v.rule)).toEqual(['label']);
  });

  it('passes `exclude` on', async () => {
    await unnamed();
    expect(await pageViolations({ exclude: ['.unnamed'] })).toEqual([]);
  });

  it('scans with .sbb-ui on <body> and removes it afterwards', async () => {
    await unnamed();
    const seen = spyOnScan();
    await pageViolations();
    expect(seen.sbbUiDuringScan).toEqual([true]);
    expect(document.body.classList.contains('sbb-ui')).toBe(false);
  });

  it('keeps a .sbb-ui class that <body> already had', async () => {
    await unnamed();
    document.body.classList.add('sbb-ui');
    await pageViolations();
    expect(document.body.classList.contains('sbb-ui')).toBe(true);
  });
});
