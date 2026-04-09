import * as Web3EthAbi from 'web3-eth-abi';

import type { AbiEventFragment, AbiInput } from '../shared/types.js';
import type {
  AbiFunctionFragment,
  DecoderSource,
  EventDescriptor,
  FunctionDescriptor,
  ParsedDecoderBundle
} from './types.js';

export function parseDecoderSources(sources: DecoderSource[]): ParsedDecoderBundle {
  const warnings: string[] = [];
  const eventDescriptorsByTopic = new Map<string, EventDescriptor>();
  const functionDescriptorsBySelector = new Map<string, FunctionDescriptor>();

  for (const source of sources) {
    const trimmed = source.content.trim();
    if (!trimmed) {
      continue;
    }

    if (looksLikeJson(source, trimmed)) {
      parseJsonDecoderSource({
        source,
        warnings,
        eventDescriptorsByTopic,
        functionDescriptorsBySelector
      });
      continue;
    }

    parseSignatureDecoderSource({
      source,
      warnings,
      eventDescriptorsByTopic,
      functionDescriptorsBySelector
    });
  }

  return {
    sources,
    cacheKey: createCacheKey(sources),
    warnings,
    eventDescriptorsByTopic,
    functionDescriptorsBySelector
  };
}

export function mergeEventDescriptorsByTopic(
  registry: ReadonlyMap<string, EventDescriptor>,
  descriptors: Iterable<EventDescriptor>
): Map<string, EventDescriptor> {
  const mergedRegistry = new Map(registry);

  for (const descriptor of descriptors) {
    registerEventDescriptor(mergedRegistry, descriptor);
  }

  return mergedRegistry;
}

function parseJsonDecoderSource(options: {
  source: DecoderSource;
  warnings: string[];
  eventDescriptorsByTopic: Map<string, EventDescriptor>;
  functionDescriptorsBySelector: Map<string, FunctionDescriptor>;
}): void {
  const {
    eventDescriptorsByTopic,
    functionDescriptorsBySelector,
    source,
    warnings
  } = options;

  try {
    const parsed = JSON.parse(source.content) as unknown;
    const items = toAbiList(parsed);

    if (!items.length) {
      warnings.push(
        `The file "${source.name}" did not contain ABI items. Upload a JSON ABI array, a single ABI fragment, or an object with an "abi" array.`
      );
      return;
    }

    let recognizedEntries = 0;

    for (const item of items) {
      if (isAbiEventFragment(item)) {
        recognizedEntries += 1;
        const descriptor = createEventDescriptorFromAbi(item);
        registerEventDescriptor(eventDescriptorsByTopic, descriptor);
        continue;
      }

      if (isAbiFunctionFragment(item)) {
        recognizedEntries += 1;
        const descriptor = createFunctionDescriptorFromAbi(item);
        registerFunctionDescriptor(functionDescriptorsBySelector, descriptor);
      }
    }

    if (!recognizedEntries) {
      warnings.push(
        `The file "${source.name}" did not define any event or function ABI fragments. Add the event ABI JSON or a signature list so the generator can decode the transaction.`
      );
    }
  } catch {
    warnings.push(
      `The file "${source.name}" could not be parsed as JSON. Upload a valid ABI JSON file, or provide a plain-text signature list instead.`
    );
  }
}

function parseSignatureDecoderSource(options: {
  source: DecoderSource;
  warnings: string[];
  eventDescriptorsByTopic: Map<string, EventDescriptor>;
  functionDescriptorsBySelector: Map<string, FunctionDescriptor>;
}): void {
  const {
    eventDescriptorsByTopic,
    functionDescriptorsBySelector,
    source,
    warnings
  } = options;

  const lines = source.content.split(/\r?\n/);
  let recognizedLines = 0;

  lines.forEach((rawLine, index) => {
    const sanitized = stripInlineComment(rawLine).trim();
    if (!sanitized) {
      return;
    }

    const parsed = parseSignatureLine(sanitized);
    if (!parsed) {
      warnings.push(
        `The signature line ${index + 1} in "${source.name}" could not be understood. Use entries such as "event Transfer(address,address,uint256)" or "transfer(address,uint256)".`
      );
      return;
    }

    recognizedLines += 1;

    if (parsed.kind === 'event') {
      const topic0 = String(Web3EthAbi.encodeEventSignature(parsed.signature)).toLowerCase();
      registerEventDescriptor(eventDescriptorsByTopic, {
        name: parsed.name,
        signature: parsed.signature,
        topic0,
        source: 'signature'
      });
      return;
    }

    const fragment: AbiFunctionFragment = {
      type: 'function',
      name: parsed.name,
      inputs: parsed.inputTypes.map((type, indexValue) => ({
        name: `arg${indexValue + 1}`,
        type
      }))
    };
    const selector = String(Web3EthAbi.encodeFunctionSignature(parsed.signature)).toLowerCase();
    registerFunctionDescriptor(functionDescriptorsBySelector, {
      name: parsed.name,
      signature: parsed.signature,
      selector,
      source: 'signature',
      fragment
    });
  });

  if (!recognizedLines) {
    warnings.push(
      `The file "${source.name}" did not contain any usable signatures. Add one declaration per line so the generator can decode clauses or label event topics.`
    );
  }
}

function parseSignatureLine(
  line: string
): { kind: 'event' | 'function'; name: string; signature: string; inputTypes: string[] } | undefined {
  const cleaned = line
    .replace(/;$/, '')
    .replace(/\banonymous\b/gi, '')
    .replace(/\s+returns\s*\(.+$/i, '')
    .trim();
  const explicitKind = cleaned.startsWith('event ')
    ? 'event'
    : cleaned.startsWith('function ')
      ? 'function'
      : undefined;
  const declaration = cleaned.replace(/^(event|function)\s+/i, '').trim();
  const match = declaration.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)$/);

  if (!match?.[1]) {
    return undefined;
  }

  const name = match[1];
  const parameters = splitParameters(match[2] ?? '')
    .map((entry) => canonicalizeParameterType(entry))
    .filter((entry): entry is string => Boolean(entry));
  const signature = `${name}(${parameters.join(',')})`;
  const kind = explicitKind ?? inferSignatureKind(cleaned, name);

  return {
    kind,
    name,
    signature,
    inputTypes: parameters
  };
}

function inferSignatureKind(line: string, name: string): 'event' | 'function' {
  if (line.includes('indexed')) {
    return 'event';
  }

  const firstCharacter = name.charAt(0);
  return firstCharacter === firstCharacter.toUpperCase() ? 'event' : 'function';
}

function splitParameters(raw: string): string[] {
  const entries: string[] = [];
  let current = '';
  let depth = 0;

  for (const character of raw) {
    if (character === ',' && depth === 0) {
      entries.push(current.trim());
      current = '';
      continue;
    }

    if (character === '(') {
      depth += 1;
    }

    if (character === ')') {
      depth = Math.max(0, depth - 1);
    }

    current += character;
  }

  if (current.trim()) {
    entries.push(current.trim());
  }

  return entries;
}

function canonicalizeParameterType(raw: string): string | undefined {
  const sanitized = raw
    .replace(/\b(indexed|memory|calldata|storage|payable|internal|external)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) {
    return undefined;
  }

  if (!sanitized.includes(' ')) {
    return sanitized;
  }

  return sanitized.split(' ')[0];
}

function looksLikeJson(source: DecoderSource, trimmedContent: string): boolean {
  return source.name.endsWith('.json') || trimmedContent.startsWith('{') || trimmedContent.startsWith('[');
}

function stripInlineComment(line: string): string {
  return line.replace(/\s*#.*$/, '').replace(/\s*\/\/.*$/, '');
}

function toAbiList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object' && 'abi' in value) {
    const nested = (value as Record<string, unknown>).abi;
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  if (value && typeof value === 'object') {
    return [value];
  }

  return [];
}

function isAbiEventFragment(value: unknown): value is AbiEventFragment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.name === 'string' &&
    Array.isArray(record.inputs) &&
    (record.type === undefined || record.type === 'event')
  );
}

function isAbiFunctionFragment(value: unknown): value is AbiFunctionFragment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.name === 'string' &&
    Array.isArray(record.inputs) &&
    (record.type === undefined || record.type === 'function')
  );
}

function createEventDescriptorFromAbi(fragment: AbiEventFragment): EventDescriptor {
  const signature = buildSignature(fragment.name, fragment.inputs);
  return {
    name: fragment.name,
    signature,
    topic0: String(Web3EthAbi.encodeEventSignature(signature)).toLowerCase(),
    source: 'abi',
    fragment
  };
}

function createFunctionDescriptorFromAbi(fragment: AbiFunctionFragment): FunctionDescriptor {
  const signature = buildSignature(fragment.name, fragment.inputs);
  return {
    name: fragment.name,
    signature,
    selector: String(Web3EthAbi.encodeFunctionSignature(signature)).toLowerCase(),
    source: 'abi',
    fragment
  };
}

function buildSignature(name: string, inputs: AbiInput[]): string {
  return `${name}(${inputs.map((input) => input.type).join(',')})`;
}

function registerEventDescriptor(
  registry: Map<string, EventDescriptor>,
  descriptor: EventDescriptor
): void {
  const current = registry.get(descriptor.topic0);
  if (!current || getDescriptorPriority(descriptor.source) > getDescriptorPriority(current.source)) {
    registry.set(descriptor.topic0, descriptor);
  }
}

function registerFunctionDescriptor(
  registry: Map<string, FunctionDescriptor>,
  descriptor: FunctionDescriptor
): void {
  const current = registry.get(descriptor.selector);
  if (!current || getDescriptorPriority(descriptor.source) > getDescriptorPriority(current.source)) {
    registry.set(descriptor.selector, descriptor);
  }
}

function getDescriptorPriority(source: EventDescriptor['source'] | FunctionDescriptor['source']): number {
  switch (source) {
    case 'signature':
      return 0;
    case 'lookup':
      return 1;
    case 'abi':
      return 2;
  }
}

function createCacheKey(sources: DecoderSource[]): string {
  return sources
    .map((source) => `${source.name}:${source.content.length}:${hashContent(source.content)}`)
    .join('|');
}

function hashContent(content: string): string {
  let value = 0;

  for (let index = 0; index < content.length; index += 1) {
    value = (value * 31 + content.charCodeAt(index)) >>> 0;
  }

  return value.toString(16);
}
