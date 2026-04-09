import type { JSX } from 'react';

export function YamlPreview(props: {
  copyState: 'idle' | 'copied' | 'error';
  error?: string;
  onCopy: () => Promise<void>;
  yaml?: string;
}): JSX.Element {
  return (
    <section className="panel stack">
      <div className="panel__header">
        <p className="eyebrow">Output</p>
        <h2>Generated YAML</h2>
      </div>
      {props.error ? (
        <div className="notice notice--warning" role="status">
          {props.error}
        </div>
      ) : null}
      {props.yaml ? (
        <>
          <pre className="code-block">{props.yaml}</pre>
          <button className="button button--primary" onClick={() => void props.onCopy()} type="button">
            {props.copyState === 'copied'
              ? 'Copied to clipboard'
              : props.copyState === 'error'
                ? 'Copy failed, try again'
                : 'Copy YAML'}
          </button>
        </>
      ) : (
        <p className="muted">
          Select a ready trigger and fill the request details to generate the YAML file.
        </p>
      )}
    </section>
  );
}
