import { describe, expect, it, vi } from 'vitest';

import {
  normalizeTransactionInput,
  probeTransactionNetworks,
  selectProbeResult
} from '../../../src/generator/network.js';
import {
  mainTransactionDetail,
  mainTransactionId,
  mainTransactionReceipt
} from '../../fixtures/generatorFixtures.js';

describe('generator network helpers', () => {
  it('extracts the transaction id and network hint from a URL', () => {
    const normalized = normalizeTransactionInput(
      `https://explore-testnet.vechain.org/transactions/${mainTransactionId}`
    );

    expect(normalized.txId).toBe(mainTransactionId);
    expect(normalized.networkHint).toBe('test');
    expect(normalized.source).toBe('url');
  });

  it('extracts the transaction id from a public explorer URL', () => {
    const explorerUrl =
      'https://vechainstats.com/transaction/0x167aa5442d4fd0599fa472bbc62731e5e532083f7ad6eaebf76c58ebd646c8be/';
    const normalized = normalizeTransactionInput(explorerUrl);

    expect(normalized.txId).toBe(
      '0x167aa5442d4fd0599fa472bbc62731e5e532083f7ad6eaebf76c58ebd646c8be'
    );
    expect(normalized.source).toBe('url');
    expect(normalized.networkHint).toBeUndefined();
  });

  it('probes both networks and prefers the confirmed result', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url.includes('mainnet.vechain.org/transactions/') && url.endsWith('/receipt')) {
        return createJsonResponse(mainTransactionReceipt);
      }

      if (url.includes('mainnet.vechain.org/transactions/')) {
        return createJsonResponse(mainTransactionDetail);
      }

      return createJsonResponse(null);
    }) as typeof fetch;
    const normalizedInput = normalizeTransactionInput(mainTransactionId);
    const results = await probeTransactionNetworks({
      normalizedInput,
      fetchImpl: fetchMock
    });
    const selected = selectProbeResult({
      requestedNetwork: 'auto',
      results
    });

    expect(results.map((result) => result.network)).toEqual(['main', 'test']);
    expect(results[0]?.status).toBe('confirmed');
    expect(results[1]?.status).toBe('not-found');
    expect(selected?.network).toBe('main');
    expect(fetchMock).toHaveBeenCalledWith(
      `https://mainnet.vechain.org/transactions/${mainTransactionId}?pending=true`,
      undefined
    );
  });
});

function createJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json'
    }
  });
}
