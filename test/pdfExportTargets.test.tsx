import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from 'vitest-browser-react';
import { useOfferForPdfExport } from '../src/hooks/useOfferForPdfExport';
import { PDF_EXPORT_TARGETS_KEY, type PdfExportTarget, offerForPdfExport } from '../src/services/pdfExportTargets';

// The offers go to the top window, which in browser mode is the runner page, and every test runs in an
// iframe of it: the very position of a widget app shown in an iframe of a Live Report. What pdf-exporter
// reads from the set is in its own tests; these read the set as it does.

type TopWindow = Window & typeof globalThis & { [PDF_EXPORT_TARGETS_KEY]?: Set<PdfExportTarget> };
const top = () => window.top as TopWindow;
const offers = () => [...(top()[PDF_EXPORT_TARGETS_KEY] ?? [])];

const withdrawals: (() => void)[] = [];
/** Offers through the function under test, and withdraws again after the test. */
const offer = (title: string, anchor?: () => Element | null) => {
  const withdraw = offerForPdfExport(title, anchor);
  withdrawals.push(withdraw);
  return withdraw;
};

afterEach(() => {
  cleanup();
  withdrawals.splice(0).forEach((withdraw) => withdraw());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('offerForPdfExport', () => {
  it('offers a widget of the page by the element it gives', () => {
    const element = document.body.appendChild(document.createElement('div'));
    offer('Timesheet Report', () => element);

    expect(offers().map((target) => target.title)).toEqual(['Timesheet Report']);
    expect(offers()[0].anchor()).toBe(element);
  });

  it('offers an app in an iframe by the iframe', () => {
    offer('GitHub Items');

    expect(offers()).toHaveLength(1);
    expect(offers()[0].anchor()).toBe(window.frameElement);
    expect(window.frameElement).not.toBeNull();
  });

  it('offers nothing for an app outside an iframe which gives no element', () => {
    vi.stubGlobal('frameElement', null);
    offer('Timesheet Report');

    expect(offers()).toEqual([]);
  });

  it('offers nothing for an app in an iframe of another origin which gives no element', () => {
    // What window.frameElement does there
    vi.spyOn(window, 'frameElement', 'get').mockImplementation(() => {
      throw new DOMException('Blocked a frame from accessing a cross-origin frame', 'SecurityError');
    });
    offer('Timesheet Report');
    vi.restoreAllMocks();

    expect(offers()).toEqual([]);
    expect(window.frameElement).not.toBeNull();
  });

  it('keeps the offers in a set of the top window', () => {
    // A set of the iframe's own would go with its document when Polarion reloads the iframe
    offer('Timesheet Report');

    expect(top()[PDF_EXPORT_TARGETS_KEY]).toBeInstanceOf(top().Set);
  });

  it('adds to the offers of other widgets', () => {
    offer('Timesheet Report');
    offer('GitHub Items');

    expect(offers().map((target) => target.title)).toEqual(['Timesheet Report', 'GitHub Items']);
  });

  it('withdraws the offer by what it returns', () => {
    const withdraw = offer('Timesheet Report');
    offer('GitHub Items');
    withdraw();

    expect(offers().map((target) => target.title)).toEqual(['GitHub Items']);
  });

  it('withdraws the offer when its document goes away', () => {
    // What a reload of the iframe does: the old offer would call into a document which is gone
    offer('Timesheet Report');
    window.dispatchEvent(new PageTransitionEvent('pagehide'));

    expect(offers()).toEqual([]);
  });

  it('keeps the offer of a page the browser keeps for the way back', () => {
    // Restored from the back/forward cache, the page runs no effect again: an offer withdrawn here would be lost
    offer('Timesheet Report');
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));

    expect(offers().map((target) => target.title)).toEqual(['Timesheet Report']);
  });
});

describe('useOfferForPdfExport', () => {
  function Widget({ title, anchor }: Readonly<{ title: string; anchor?: () => Element | null }>) {
    useOfferForPdfExport(title, anchor);
    return null;
  }

  it('offers the widget while it is mounted', async () => {
    const rendered = await render(<Widget title="Timesheet Report" />);
    expect(offers().map((target) => target.title)).toEqual(['Timesheet Report']);

    await rendered.unmount();
    expect(offers()).toEqual([]);
  });

  it('offers once however often it renders, and asks the anchor of the latest render', async () => {
    const first = document.body.appendChild(document.createElement('div'));
    const second = document.body.appendChild(document.createElement('div'));
    const rendered = await render(<Widget title="Timesheet Report" anchor={() => first} />);
    await rendered.rerender(<Widget title="Timesheet Report" anchor={() => second} />);

    expect(offers()).toHaveLength(1);
    expect(offers()[0].anchor()).toBe(second);
  });

  it('offers anew under a new title', async () => {
    const rendered = await render(<Widget title="Timesheet Report" />);
    await rendered.rerender(<Widget title="Team Timesheet" />);

    expect(offers().map((target) => target.title)).toEqual(['Team Timesheet']);
  });
});
