import { useQuery } from '@tanstack/react-query';

import { buildTriggerOptions } from '@generator/analyzeTransaction';
import { mergeEventDescriptorsByTopic } from '@generator/parseDecoderSources';
import {
  normalizeTransactionInput,
  probeTransactionNetworks,
  selectProbeResult,
  type NetworkSelection
} from '@generator/network';
import { lookupEventDescriptors } from '@generator/signatureLookup';
import type {
  AnalyzedTriggerOption,
  ParsedDecoderBundle
} from '@generator/types';
import type { NetworkName } from '../../../../../src/shared/types.js';

interface QueryData {
  normalizedInput: ReturnType<typeof normalizeTransactionInput>;
  results: Awaited<ReturnType<typeof probeTransactionNetworks>>;
  triggersByNetwork: Partial<Record<NetworkName, AnalyzedTriggerOption[]>>;
  warnings: string[];
}

export function useTransactionAnalysis(options: {
  decoderBundle: ParsedDecoderBundle;
  selectedNetwork: NetworkSelection;
  submittedInput: string;
}): {
  activeResult: QueryData['results'][number] | undefined;
  activeTriggers: AnalyzedTriggerOption[];
  inputError?: string;
  query: ReturnType<typeof useQuery<QueryData>>;
  warnings: string[];
} {
  const submittedInput = options.submittedInput.trim();
  let normalizedInput: ReturnType<typeof normalizeTransactionInput> | undefined;
  let inputError: string | undefined;

  if (submittedInput) {
    try {
      normalizedInput = normalizeTransactionInput(submittedInput);
    } catch (error) {
      inputError = error instanceof Error
        ? error.message
        : 'Enter a valid transaction id or URL so the generator can inspect the receipt.';
    }
  }

  const query = useQuery<QueryData>({
    enabled: Boolean(normalizedInput),
    queryKey: [
      'transaction-analysis',
      normalizedInput?.txId ?? '',
      normalizedInput?.networkHint ?? 'none',
      options.selectedNetwork,
      options.decoderBundle.cacheKey
    ],
    queryFn: async () => {
      if (!normalizedInput) {
        throw new Error(
          'Enter a valid transaction id or URL so the generator can inspect the receipt.'
        );
      }

      const preferredNetwork =
        options.selectedNetwork === 'auto'
          ? normalizedInput.networkHint
          : options.selectedNetwork;
      const results = await probeTransactionNetworks({
        normalizedInput,
        ...(preferredNetwork ? { preferredNetwork } : {})
      });
      const confirmedReceipts = results.flatMap((result) =>
        result.status === 'confirmed' && result.receipt ? [result.receipt] : []
      );
      const lookupResult = await lookupEventDescriptors({
        decoderBundle: options.decoderBundle,
        receipts: confirmedReceipts
      });
      const mergedDecoderBundle: ParsedDecoderBundle = {
        ...options.decoderBundle,
        eventDescriptorsByTopic: mergeEventDescriptorsByTopic(
          options.decoderBundle.eventDescriptorsByTopic,
          lookupResult.descriptors
        )
      };
      const triggersByNetwork: Partial<Record<NetworkName, AnalyzedTriggerOption[]>> = {};

      results.forEach((result) => {
        if (result.status !== 'confirmed' || !result.transaction || !result.receipt) {
          return;
        }

        triggersByNetwork[result.network] = buildTriggerOptions({
          decoderBundle: mergedDecoderBundle,
          receipt: result.receipt,
          transaction: result.transaction
        });
      });

      return {
        normalizedInput,
        results,
        triggersByNetwork,
        warnings: [...options.decoderBundle.warnings, ...lookupResult.warnings]
      };
    }
  });

  const activeResult = query.data
    ? selectProbeResult({
        requestedNetwork: options.selectedNetwork,
        results: query.data.results,
        ...(query.data.normalizedInput.networkHint
          ? { networkHint: query.data.normalizedInput.networkHint }
          : {})
      })
    : undefined;
  const activeTriggers = activeResult
    ? query.data?.triggersByNetwork[activeResult.network] ?? []
    : [];

  return {
    activeResult,
    activeTriggers,
    query,
    warnings: query.data?.warnings ?? options.decoderBundle.warnings,
    ...(inputError ? { inputError } : {})
  };
}
