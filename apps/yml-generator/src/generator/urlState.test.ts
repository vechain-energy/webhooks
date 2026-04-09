import { describe, expect, it } from 'vitest';

import {
  buildTransactionSearchHref,
  readTransactionInputFromSearch
} from '@app/generator/urlState';

describe('generator URL state helpers', () => {
  it('reads the deep-linked transaction id from the search params', () => {
    expect(readTransactionInputFromSearch('?txid=0xabc123')).toBe('0xabc123');
  });

  it('writes the normalized transaction id back into the page URL', () => {
    expect(
      buildTransactionSearchHref({
        currentUrl: 'https://example.com/app?foo=bar#preview',
        txId: '0xabc123'
      })
    ).toBe('/app?foo=bar&txid=0xabc123#preview');
  });
});
