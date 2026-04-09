import type { JSX } from 'react';

import type { AnalyzedTriggerOption } from '@generator/types';

export function TriggerList(props: {
  onSelect: (triggerId: string) => void;
  selectedTriggerId: string;
  triggers: AnalyzedTriggerOption[];
}): JSX.Element | null {
  if (!props.triggers.length) {
    return null;
  }

  return (
    <section className="panel stack">
      <div className="panel__header">
        <p className="eyebrow">Triggers</p>
        <h2>Detected triggers</h2>
      </div>
      <ul className="trigger-list">
        {props.triggers.map((trigger) => (
          <li key={trigger.id}>
            <button
              className={`trigger-card${
                props.selectedTriggerId === trigger.id ? ' trigger-card--active' : ''
              }`}
              onClick={() => props.onSelect(trigger.id)}
              type="button"
            >
              <div className="trigger-card__header">
                <div>
                  <p className="eyebrow">{trigger.kind}</p>
                  <h3>{trigger.title}</h3>
                </div>
                <span
                  className={`pill pill--${
                    trigger.selectionStatus === 'ready' ? 'confirmed' : 'pending'
                  }`}
                >
                  {trigger.selectionStatus === 'ready' ? 'YAML ready' : 'Preview only'}
                </span>
              </div>
              <p className="muted">{trigger.subtitle}</p>
              <dl className="trigger-card__meta">
                <div>
                  <dt>Occurrences</dt>
                  <dd>{trigger.occurrenceCount}</dd>
                </div>
                <div>
                  <dt>Addresses</dt>
                  <dd>{trigger.addresses.length ? trigger.addresses.join(', ') : 'Any address'}</dd>
                </div>
              </dl>
              <ul className="trigger-card__fields">
                {buildPreviewRows(trigger).map((row) => (
                  <li className="trigger-card__field" key={row.key}>
                    <span className="trigger-card__field-key">{row.key}</span>
                    <strong className="trigger-card__field-value" title={row.title}>
                      {row.value}
                    </strong>
                  </li>
                ))}
              </ul>
              {trigger.selectionMessage ? (
                <p className="notice-inline">{trigger.selectionMessage}</p>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function buildPreviewRows(trigger: AnalyzedTriggerOption): Array<{
  key: string;
  title: string;
  value: string;
}> {
  const entries = Object.entries(trigger.decoded)
    .filter(([, value]) => value !== undefined && value !== null && formatValue(value) !== '')
    .slice(0, 4)
    .map(([key, value]) => {
      const formatted = formatValue(value);

      return {
        key,
        title: formatted,
        value: truncatePreview(formatted)
      };
    });

  if (Object.keys(trigger.decoded).length > entries.length) {
    entries.push({
      key: 'more',
      title: `${Object.keys(trigger.decoded).length - entries.length} more decoded fields are available on selection.`,
      value: `+${Object.keys(trigger.decoded).length - entries.length} more fields`
    });
  }

  return entries;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return JSON.stringify(value);
}

function truncatePreview(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 56) {
    return normalized;
  }

  return `${normalized.slice(0, 28)}…${normalized.slice(-16)}`;
}
