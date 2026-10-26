import { describe, expect, it, vi } from 'vitest';
import type { SendRequest } from '../src/types';
import { loadBulkExportItems, readBulkExportWidgetShim } from '../src/widgets/bulkExportItems';
import { SAMPLE_ITEMS, SAMPLE_SHIM } from './bulkExportSamples';

const answering = (status: number, body: string): SendRequest =>
  vi.fn(() => Promise.resolve(new Response(body, { status, headers: { 'Content-Type': 'application/json' } })));

describe('loadBulkExportItems', () => {
  it('posts the descriptor of the shim back unchanged, and returns the rows', async () => {
    const sendRequest = answering(200, JSON.stringify(SAMPLE_ITEMS));

    await expect(loadBulkExportItems(sendRequest, SAMPLE_SHIM)).resolves.toEqual(SAMPLE_ITEMS);

    expect(sendRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/widgets/bulk-export/items',
      contentType: 'application/json',
      body: JSON.stringify({ descriptor: SAMPLE_SHIM.descriptor, signature: SAMPLE_SHIM.signature }),
    });
  });

  it('rejects with what the endpoint says when it refuses the descriptor', async () => {
    const message = 'The widget descriptor is missing or was not signed by this server. Reload the page.';

    await expect(loadBulkExportItems(answering(400, JSON.stringify({ message })), SAMPLE_SHIM)).rejects.toThrow(
      message,
    );
    await expect(
      loadBulkExportItems(answering(500, JSON.stringify({ errorMessage: 'Broken' })), SAMPLE_SHIM),
    ).rejects.toThrow('Broken');
  });

  it('rejects with a message of its own when the endpoint says nothing readable', async () => {
    await expect(loadBulkExportItems(answering(502, '<html>Bad Gateway</html>'), SAMPLE_SHIM)).rejects.toThrow(
      'Could not load the items of this widget.',
    );
    await expect(loadBulkExportItems(answering(500, '{}'), SAMPLE_SHIM)).rejects.toThrow(
      'Could not load the items of this widget.',
    );
  });
});

describe('loadBulkExportItems on an answer that is not a table', () => {
  it('rejects a successful answer without rows, so that the widget shows an error instead of loading forever', async () => {
    await expect(loadBulkExportItems(answering(200, 'not json'), SAMPLE_SHIM)).rejects.toThrow(
      'Could not load the items of this widget.',
    );
    await expect(loadBulkExportItems(answering(200, '{"columns":[]}'), SAMPLE_SHIM)).rejects.toThrow(
      'Could not load the items of this widget.',
    );
    await expect(loadBulkExportItems(answering(200, '{"items":[]}'), SAMPLE_SHIM)).rejects.toThrow(
      'Could not load the items of this widget.',
    );
  });
});

describe('readBulkExportWidgetShim', () => {
  it('reads what the renderer put on the shim', () => {
    const host = document.createElement('div');
    host.setAttribute('data-descriptor', SAMPLE_SHIM.descriptor);
    host.setAttribute('data-signature', SAMPLE_SHIM.signature);
    host.setAttribute('data-title', 'Test Runs');

    expect(readBulkExportWidgetShim(host)).toEqual(SAMPLE_SHIM);
  });

  it('falls back to empty values on a shim without attributes', () => {
    expect(readBulkExportWidgetShim(document.createElement('div'))).toEqual({
      descriptor: '',
      signature: '',
      title: '',
    });
  });
});
