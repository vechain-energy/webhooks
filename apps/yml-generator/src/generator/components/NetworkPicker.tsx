import type { JSX } from 'react';

import type { NetworkSelection } from '@generator/network';
import type { NetworkProbeResult } from '@generator/types';

const optionLabels: Array<{ label: string; value: NetworkSelection }> = [
  { label: 'Auto', value: 'auto' },
  { label: 'Mainnet', value: 'main' },
  { label: 'Testnet', value: 'test' }
];

export function NetworkPicker(props: {
  onChange: (value: NetworkSelection) => void;
  results: NetworkProbeResult[];
  value: NetworkSelection;
}): JSX.Element | null {
  if (!props.results.length) {
    return null;
  }

  return (
    <section className="panel stack">
      <div className="panel__header">
        <p className="eyebrow">Review</p>
        <h2>Choose the receipt source</h2>
      </div>
      <div className="segment-control" role="tablist" aria-label="Network selection">
        {optionLabels.map((option) => (
          <button
            aria-selected={props.value === option.value}
            className={`segment-control__item${
              props.value === option.value ? ' segment-control__item--active' : ''
            }`}
            key={option.value}
            onClick={() => props.onChange(option.value)}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="network-grid">
        {props.results.map((result) => (
          <article className="network-card" key={result.network}>
            <div className="network-card__header">
              <h3>{result.network === 'main' ? 'Mainnet' : 'Testnet'}</h3>
              <span className={`pill pill--${result.status}`}>{result.status}</span>
            </div>
            <p className="muted">{result.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
