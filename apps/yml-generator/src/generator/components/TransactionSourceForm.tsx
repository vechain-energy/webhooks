import type { ChangeEvent, FormEvent, JSX } from 'react';

export function TransactionSourceForm(props: {
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
  submitLabel: string;
  value: string;
}): JSX.Element {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    props.onSubmit();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    props.onChange(event.target.value);
  }

  return (
    <section className="panel stack">
      <div className="panel__header">
        <p className="eyebrow">Transaction</p>
        <h2>Transaction source</h2>
      </div>
      <p className="muted">
        Paste a bare transaction id or a VeChain explorer link. The app will
        probe mainnet and testnet automatically, then rewrite the page URL with
        the normalized tx id so you can share the analysis link.
      </p>
      <form className="stack" onSubmit={handleSubmit}>
        <label className="field" htmlFor="tx-input">
          <span className="field__label">Transaction id or link</span>
          <input
            id="tx-input"
            name="tx-input"
            onChange={handleChange}
            placeholder="0x... or https://..."
            type="text"
            value={props.value}
          />
        </label>
        <button
          className="button button--primary"
          disabled={props.isLoading || props.submitDisabled === true}
          type="submit"
        >
          {props.isLoading ? 'Analyzing transaction…' : props.submitLabel}
        </button>
      </form>
    </section>
  );
}
