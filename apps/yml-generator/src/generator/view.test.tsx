import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@app/app/view';
import {
  mainTransactionDetail,
  mainTransactionId,
  mainTransactionReceipt,
  signatureListText,
  transferAbiJson
} from '../../../../test/fixtures/generatorFixtures.js';

describe('GeneratorView', () => {
  const clipboardWriteText = vi.fn(async () => undefined);
  const publicExplorerTransactionUrl =
    `https://vechainstats.com/transaction/${mainTransactionId}/`;

  beforeEach(() => {
    clipboardWriteText.mockClear();
    window.history.replaceState(window.history.state, '', '/');
    const navigatorMock = Object.assign(Object.create(window.navigator), {
      clipboard: {
        writeText: clipboardWriteText
      }
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
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
      })
    );
    vi.stubGlobal('navigator', navigatorMock);
    Object.defineProperty(window, 'navigator', {
      configurable: true,
      value: navigatorMock
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('supports the full analyze, preview-only, edit, copy, and network override flow', async () => {
    const user = userEvent.setup();

    render(<App />);
    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Current step/i);
    expect(screen.getByText(/^Optional decoders$/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Transaction id or link/i), mainTransactionId);
    await user.click(screen.getByRole('button', { name: /Continue to optional decoders/i }));
    expect(screen.getByText(/Step 2 of 5/i)).toBeInTheDocument();

    await user.upload(screen.getByLabelText(/Decoder files/i), [
      new File([transferAbiJson], 'erc20.json', { type: 'application/json' }),
      new File([signatureListText], 'signatures.txt', { type: 'text/plain' })
    ]);
    await user.click(screen.getByRole('button', { name: /Analyze receipt/i }));
    expect(screen.getByText(/Step 3 of 5/i)).toBeInTheDocument();

    await screen.findByRole('button', { name: /Transfer event/i });
    await screen.findByRole('button', { name: /Ping event/i });

    expect(screen.getByText(/Upload the ABI JSON that defines Ping/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Transfer event/i }));
    await user.click(screen.getByRole('button', { name: /Continue to webhook editor/i }));
    await user.clear(screen.getByLabelText(/Request URL/i));
    await user.type(
      screen.getByLabelText(/Request URL/i),
      'https://hooks.example.com/events'
    );
    await user.type(screen.getByLabelText(/Description/i), 'Generated from a receipt');
    await user.click(screen.getByRole('button', { name: /Continue to YAML preview/i }));
    await user.click(screen.getByRole('button', { name: /Copy YAML/i }));
    await screen.findByRole('button', {
      name: /Copied to clipboard|Copy failed, try again/i
    });

    await user.click(screen.getByRole('button', { name: /Back to webhook editor/i }));
    await user.click(screen.getByRole('button', { name: /Back to trigger review/i }));
    await user.click(screen.getByRole('tab', { name: /Testnet/i }));
    expect(
      await screen.findAllByText(/The transaction was not found on testnet/i)
    ).toHaveLength(2);
  });

  it('auto analyzes a deep-linked transaction id from the page URL', async () => {
    window.history.replaceState(window.history.state, '', `/?txid=${mainTransactionId}`);

    render(<App />);

    await screen.findByRole('button', { name: /Transactions from/i });
    await userEvent.setup().click(screen.getByRole('button', { name: /Transaction source/i }));
    expect(screen.getByLabelText(/Transaction id or link/i)).toHaveValue(mainTransactionId);
  });

  it('updates the browser URL after analyzing a public explorer link', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.type(screen.getByLabelText(/Transaction id or link/i), publicExplorerTransactionUrl);
    await user.click(screen.getByRole('button', { name: /Continue to optional decoders/i }));
    await user.click(screen.getByRole('button', { name: /Analyze receipt/i }));

    await screen.findByRole('button', { name: /Transactions from/i });
    expect(window.location.search).toBe(`?txid=${mainTransactionId}`);
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
