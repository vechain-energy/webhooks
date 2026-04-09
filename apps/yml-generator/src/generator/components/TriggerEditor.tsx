import type { ChangeEvent, JSX } from 'react';

import type { AnalyzedTriggerOption, WebhookEditorState } from '@generator/types';

export function TriggerEditor(props: {
  editorState: WebhookEditorState | null;
  onAddAddress: () => void;
  onAddHeader: () => void;
  onRemoveAddress: (index: number) => void;
  onRemoveHeader: (headerId: string) => void;
  onUpdateAddress: (index: number, value: string) => void;
  onUpdateHeader: (headerId: string, field: 'key' | 'value', value: string) => void;
  onUpdateState: (
    key: keyof WebhookEditorState,
    value: WebhookEditorState[keyof WebhookEditorState]
  ) => void;
  trigger: AnalyzedTriggerOption | null;
}): JSX.Element | null {
  if (!props.editorState || !props.trigger) {
    return null;
  }

  function handleFieldChange(
    key: keyof WebhookEditorState,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ): void {
    const value = event.target.type === 'checkbox'
      ? (event.target as HTMLInputElement).checked
      : event.target.value;
    props.onUpdateState(key, value as WebhookEditorState[keyof WebhookEditorState]);
  }

  return (
    <section className="panel stack">
      <div className="panel__header">
        <p className="eyebrow">Configure</p>
        <h2>Webhook editor</h2>
      </div>
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Webhook id</span>
          <input
            onChange={(event) => handleFieldChange('id', event)}
            type="text"
            value={props.editorState.id}
          />
        </label>
        <label className="field field--checkbox">
          <span className="field__label">Enabled</span>
          <input
            checked={props.editorState.enabled}
            onChange={(event) => handleFieldChange('enabled', event)}
            type="checkbox"
          />
        </label>
        <label className="field field--full">
          <span className="field__label">Description</span>
          <textarea
            onChange={(event) => handleFieldChange('description', event)}
            placeholder="Optional notes about this generated webhook."
            rows={3}
            value={props.editorState.description}
          />
        </label>
        <label className="field">
          <span className="field__label">HTTP method</span>
          <select
            onChange={(event) => handleFieldChange('requestMethod', event)}
            value={props.editorState.requestMethod}
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </label>
        <label className="field field--full">
          <span className="field__label">Request URL</span>
          <input
            onChange={(event) => handleFieldChange('requestUrl', event)}
            placeholder="https://example.com/webhooks/receive"
            type="url"
            value={props.editorState.requestUrl}
          />
        </label>
        <label className="field">
          <span className="field__label">Content type</span>
          <input
            onChange={(event) => handleFieldChange('requestContentType', event)}
            type="text"
            value={props.editorState.requestContentType}
          />
        </label>
      </div>

      <div className="stack">
        <div className="subsection-header">
          <h3>Match addresses</h3>
          <button className="button button--ghost" onClick={props.onAddAddress} type="button">
            Add address
          </button>
        </div>
        <div className="stack stack--sm">
          {props.editorState.addresses.map((address, index) => (
            <div className="inline-editor" key={`${address}-${index}`}>
              <input
                onChange={(event) => props.onUpdateAddress(index, event.target.value)}
                type="text"
                value={address}
              />
              <button
                className="button button--ghost"
                onClick={() => props.onRemoveAddress(index)}
                type="button"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="stack">
        <div className="subsection-header">
          <h3>Headers</h3>
          <button className="button button--ghost" onClick={props.onAddHeader} type="button">
            Add header
          </button>
        </div>
        {props.editorState.headers.length ? (
          <div className="stack stack--sm">
            {props.editorState.headers.map((header) => (
              <div className="inline-editor inline-editor--triple" key={header.id}>
                <input
                  onChange={(event) =>
                    props.onUpdateHeader(header.id, 'key', event.target.value)
                  }
                  placeholder="Header name"
                  type="text"
                  value={header.key}
                />
                <input
                  onChange={(event) =>
                    props.onUpdateHeader(header.id, 'value', event.target.value)
                  }
                  placeholder="Header value"
                  type="text"
                  value={header.value}
                />
                <button
                  className="button button--ghost"
                  onClick={() => props.onRemoveHeader(header.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No custom headers yet.</p>
        )}
      </div>

      <div className="form-grid">
        <label className="field field--checkbox">
          <span className="field__label">Sign requests</span>
          <input
            checked={props.editorState.signingEnabled}
            onChange={(event) => handleFieldChange('signingEnabled', event)}
            type="checkbox"
          />
        </label>
        {props.editorState.signingEnabled ? (
          <>
            <label className="field">
              <span className="field__label">Secret env name</span>
              <input
                onChange={(event) => handleFieldChange('signingSecretEnv', event)}
                type="text"
                value={props.editorState.signingSecretEnv}
              />
            </label>
            <label className="field">
              <span className="field__label">Signature header</span>
              <input
                onChange={(event) => handleFieldChange('signingHeader', event)}
                placeholder="Optional override"
                type="text"
                value={props.editorState.signingHeader}
              />
            </label>
          </>
        ) : null}
      </div>

      <label className="field field--full">
        <span className="field__label">Body template</span>
        <textarea
          onChange={(event) => handleFieldChange('requestBody', event)}
          rows={16}
          value={props.editorState.requestBody}
        />
      </label>
    </section>
  );
}
