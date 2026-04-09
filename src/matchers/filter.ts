import BigNumber from 'bignumber.js';

import { getPathValue, toRecord } from '../shared/object.js';
import type { RenderContext, WebhookFilter } from '../shared/types.js';

export function filterMatches(
  filters: WebhookFilter[] | undefined,
  context: RenderContext
): boolean {
  if (!filters?.length) {
    return true;
  }

  return filters.every((filter) => testFilter(filter, context));
}

function testFilter(filter: WebhookFilter, context: RenderContext): boolean {
  const currentValue = resolveFilterValue(filter.field, context);

  switch (filter.op) {
    case 'empty':
      return isEmpty(currentValue);
    case 'notEmpty':
      return !isEmpty(currentValue);
    case 'eq':
      return compareNumeric(currentValue, filter.value, 'eq');
    case 'neq':
      return compareNumeric(currentValue, filter.value, 'neq');
    case 'lt':
      return compareNumeric(currentValue, filter.value, 'lt');
    case 'lte':
      return compareNumeric(currentValue, filter.value, 'lte');
    case 'gt':
      return compareNumeric(currentValue, filter.value, 'gt');
    case 'gte':
      return compareNumeric(currentValue, filter.value, 'gte');
    case 'in':
      return (filter.values ?? []).includes(String(currentValue));
    case 'notIn':
      return !(filter.values ?? []).includes(String(currentValue));
  }
}

function resolveFilterValue(field: string, context: RenderContext): unknown {
  if (field.includes('.')) {
    return getPathValue(context as unknown as Record<string, unknown>, field);
  }

  const decoded = toRecord(context.decoded);
  const event = toRecord(context.event);
  const meta = toRecord(context.meta);

  return decoded[field] ?? event[field] ?? meta[field];
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || value === false;
}

function compareNumeric(
  currentValue: unknown,
  expectedValue: string | undefined,
  operator: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
): boolean {
  if (expectedValue === undefined || currentValue === undefined) {
    return false;
  }

  const currentRaw = String(currentValue);
  const expectedRaw = String(expectedValue);
  const current = new BigNumber(currentRaw);
  const expected = new BigNumber(expectedRaw);
  const bothNumeric = current.isFinite() && expected.isFinite();

  if (!bothNumeric) {
    switch (operator) {
      case 'eq':
        return currentRaw === expectedRaw;
      case 'neq':
        return currentRaw !== expectedRaw;
      default:
        return false;
    }
  }

  switch (operator) {
    case 'eq':
      return current.isEqualTo(expected);
    case 'neq':
      return !current.isEqualTo(expected);
    case 'lt':
      return current.isLessThan(expected);
    case 'lte':
      return current.isLessThanOrEqualTo(expected);
    case 'gt':
      return current.isGreaterThan(expected);
    case 'gte':
      return current.isGreaterThanOrEqualTo(expected);
  }
}
