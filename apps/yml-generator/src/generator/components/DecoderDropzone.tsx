import { useId, useState, type JSX } from 'react';

import type { DecoderSource } from '@generator/types';

export function DecoderDropzone(props: {
  onAddFiles: (files: File[]) => Promise<void>;
  onClear: () => void;
  onRemove: (sourceId: string) => void;
  sources: DecoderSource[];
  warnings: string[];
}): JSX.Element {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  async function handleFileSelection(files: FileList | null): Promise<void> {
    if (!files?.length) {
      return;
    }

    await props.onAddFiles([...files]);
  }

  return (
    <section className="panel stack">
      <div className="panel__header">
        <p className="eyebrow">Decoders</p>
        <h2>Optional decoder inputs</h2>
      </div>
      <p className="muted">
        Add ABI JSON files or newline-based signatures when you want richer
        decoding. You can skip this step and let the built-in VeChain signature
        registry resolve common events first.
      </p>
      <label
        className={`dropzone${isDragging ? ' dropzone--active' : ''}`}
        htmlFor={inputId}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void handleFileSelection(event.dataTransfer.files);
        }}
      >
        <input
          aria-label="Decoder files"
          id={inputId}
          multiple
          onChange={(event) => {
            void handleFileSelection(event.target.files);
            event.target.value = '';
          }}
          type="file"
        />
        <span>Choose files or drag them here</span>
        <small>Supports ABI JSON and plain-text signature lists.</small>
      </label>
      {props.sources.length > 0 ? (
        <div className="stack stack--sm">
          <div className="chip-grid">
            {props.sources.map((source) => (
              <div className="chip" key={source.id}>
                <span>{source.name}</span>
                <button
                  aria-label={`Remove ${source.name}`}
                  className="chip__action"
                  onClick={() => props.onRemove(source.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button className="button button--ghost" onClick={props.onClear} type="button">
            Clear decoder files
          </button>
        </div>
      ) : null}
      {props.warnings.length > 0 ? (
        <div className="notice notice--warning" role="status">
          <strong>Decoder guidance</strong>
          <ul className="notice__list">
            {props.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
