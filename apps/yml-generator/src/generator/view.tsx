import { useEffect, useState, type JSX } from 'react';

import { createWebhookEditorState, createEmptyHeaderField } from '@generator/createWebhookEditorState';
import { parseDecoderSources } from '@generator/parseDecoderSources';
import { renderWebhookYaml } from '@generator/renderWebhookYaml';
import type { DecoderSource, WebhookEditorState } from '@generator/types';

import { DecoderDropzone } from '@app/generator/components/DecoderDropzone';
import { NetworkPicker } from '@app/generator/components/NetworkPicker';
import { TransactionSourceForm } from '@app/generator/components/TransactionSourceForm';
import { TriggerEditor } from '@app/generator/components/TriggerEditor';
import { TriggerList } from '@app/generator/components/TriggerList';
import { WizardStepper, type WizardStepDefinition } from '@app/generator/components/WizardStepper';
import { YamlPreview } from '@app/generator/components/YamlPreview';
import { useTransactionAnalysis } from '@app/generator/hooks/useTransactionAnalysis';
import type { NetworkSelection } from '@generator/network';
import {
  buildTransactionSearchHref,
  readTransactionInputFromSearch
} from '@app/generator/urlState';

type WizardStepId = 'source' | 'decoders' | 'review' | 'configure' | 'yaml';

const wizardStepOrder: WizardStepId[] = [
  'source',
  'decoders',
  'review',
  'configure',
  'yaml'
];

export function GeneratorView(): JSX.Element {
  const initialTxInput = readTransactionInputFromSearch(window.location.search);
  const [txInput, setTxInput] = useState(() => initialTxInput);
  const [submittedInput, setSubmittedInput] = useState(() => initialTxInput);
  const [activeStep, setActiveStep] = useState<WizardStepId>(() =>
    initialTxInput ? 'review' : 'source'
  );
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkSelection>('auto');
  const [decoderSources, setDecoderSources] = useState<DecoderSource[]>([]);
  const [selectedTriggerId, setSelectedTriggerId] = useState('');
  const [editorState, setEditorState] = useState<WebhookEditorState | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const decoderBundle = parseDecoderSources(decoderSources);
  const analysis = useTransactionAnalysis({
    decoderBundle,
    selectedNetwork,
    submittedInput
  });
  const selectedTrigger =
    analysis.activeTriggers.find((trigger) => trigger.id === selectedTriggerId) ?? null;
  const yamlResult = selectedTrigger && editorState
    ? renderWebhookYaml({
        editorState,
        trigger: selectedTrigger
      })
    : {};
  const wizardSteps = createWizardSteps({
    activeStep,
    hasSelectedTrigger: Boolean(selectedTrigger),
    hasSubmittedInput: Boolean(submittedInput.trim()),
    hasYamlContext: Boolean(selectedTrigger && editorState)
  });

  useEffect(() => {
    if (!analysis.activeTriggers.length) {
      if (selectedTriggerId) {
        setSelectedTriggerId('');
      }

      if (editorState) {
        setEditorState(null);
      }

      if ((activeStep === 'configure' || activeStep === 'yaml') && submittedInput.trim()) {
        setActiveStep('review');
      }

      return;
    }

    if (!analysis.activeTriggers.some((trigger) => trigger.id === selectedTriggerId)) {
      setSelectedTriggerId(analysis.activeTriggers[0]?.id ?? '');
    }
  }, [activeStep, analysis.activeTriggers, editorState, selectedTriggerId, submittedInput]);

  useEffect(() => {
    if (!selectedTrigger) {
      return;
    }

    setEditorState(createWebhookEditorState(selectedTrigger));
    setCopyState('idle');
  }, [selectedTrigger?.id, analysis.activeResult?.network]);

  useEffect(() => {
    const normalizedTxId = analysis.query.data?.normalizedInput.txId;

    if (!normalizedTxId) {
      return;
    }

    const nextHref = buildTransactionSearchHref({
      currentUrl: window.location.href,
      txId: normalizedTxId
    });
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextHref !== currentHref) {
      window.history.replaceState(window.history.state, '', nextHref);
    }
  }, [analysis.query.data?.normalizedInput.txId]);

  async function handleAddFiles(files: File[]): Promise<void> {
    const nextSources = await Promise.all(
      files.map(async (file) => ({
        id: createSourceId(file),
        name: file.name,
        content: await file.text()
      }))
    );

    setDecoderSources((current) => [
      ...current,
      ...nextSources.filter(
        (nextSource) =>
          !current.some(
            (currentSource) =>
              currentSource.name === nextSource.name &&
              currentSource.content === nextSource.content
          )
      )
    ]);
  }

  async function handleCopy(): Promise<void> {
    if (!yamlResult.yaml) {
      return;
    }

    try {
      await navigator.clipboard.writeText(yamlResult.yaml);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  function handleAnalyzeReceipt(): void {
    setSubmittedInput(txInput);
    setSelectedNetwork('auto');
    setCopyState('idle');
    setActiveStep('review');
  }

  function handleStepChange(nextStep: string): void {
    if (isWizardStepId(nextStep) && isStepUnlocked(nextStep)) {
      setActiveStep(nextStep);
    }
  }

  function isStepUnlocked(stepId: WizardStepId): boolean {
    switch (stepId) {
      case 'source':
      case 'decoders':
        return true;
      case 'review':
        return Boolean(submittedInput.trim());
      case 'configure':
        return Boolean(selectedTrigger);
      case 'yaml':
        return Boolean(selectedTrigger && editorState);
    }
  }

  function updateEditorState(
    key: keyof WebhookEditorState,
    value: WebhookEditorState[keyof WebhookEditorState]
  ): void {
    setEditorState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [key]: value
      };
    });
    setCopyState('idle');
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__copy stack">
          <p className="eyebrow">VeChain webhook YAML generator</p>
          <h1>Turn a transaction receipt into a webhook config you can ship.</h1>
          <p className="hero__lede">
            Inspect a transaction, decode matching logs and clauses, then copy a
            ready-to-store webhook YAML file without leaving the browser.
          </p>
        </div>
      </section>

      <section className="wizard-shell stack">
        <WizardStepper activeStepId={activeStep} onChange={handleStepChange} steps={wizardSteps} />

        <div className="wizard-panel">
          {activeStep === 'source' ? (
            <div className="stack">
              <TransactionSourceForm
                isLoading={analysis.query.isFetching}
                onChange={setTxInput}
                onSubmit={() => setActiveStep('decoders')}
                submitDisabled={!txInput.trim()}
                submitLabel="Continue to optional decoders"
                value={txInput}
              />
            </div>
          ) : null}

          {activeStep === 'decoders' ? (
            <div className="stack">
              <DecoderDropzone
                onAddFiles={handleAddFiles}
                onClear={() => setDecoderSources([])}
                onRemove={(sourceId) =>
                  setDecoderSources((current) => current.filter((source) => source.id !== sourceId))
                }
                sources={decoderSources}
                warnings={analysis.warnings}
              />
              <div className="wizard-actions">
                <button
                  className="button button--ghost"
                  onClick={() => setActiveStep('source')}
                  type="button"
                >
                  Back to transaction source
                </button>
                <button
                  className="button button--primary"
                  disabled={!txInput.trim()}
                  onClick={handleAnalyzeReceipt}
                  type="button"
                >
                  {decoderSources.length > 0 ? 'Analyze receipt' : 'Skip and analyze receipt'}
                </button>
              </div>
            </div>
          ) : null}

          {activeStep === 'review' ? (
            <div className="stack">
              <section className="panel stack">
                <div className="panel__header">
                  <div>
                    <p className="eyebrow">Review</p>
                    <h2>Inspect the receipt and choose the trigger you want to keep.</h2>
                  </div>
                </div>
                <p className="muted">
                  Check the network result, compare the trigger candidates, and keep the one that
                  should drive the webhook configuration.
                </p>
              </section>
              {analysis.inputError ? (
                <div className="notice notice--warning" role="alert">
                  {analysis.inputError}
                </div>
              ) : null}
              {analysis.query.error instanceof Error ? (
                <div className="notice notice--warning" role="alert">
                  {analysis.query.error.message}
                </div>
              ) : null}
              {analysis.query.isFetching ? (
                <div className="notice notice--warning" role="status">
                  Loading the transaction receipt and matching triggers. Keep this step open until
                  the result list appears.
                </div>
              ) : null}
              <NetworkPicker
                onChange={setSelectedNetwork}
                results={analysis.query.data?.results ?? []}
                value={selectedNetwork}
              />
              {analysis.activeResult && analysis.activeResult.status !== 'confirmed' ? (
                <div className="notice notice--warning" role="status">
                  {analysis.activeResult.message}
                </div>
              ) : null}
              <TriggerList
                onSelect={setSelectedTriggerId}
                selectedTriggerId={selectedTriggerId}
                triggers={analysis.activeTriggers}
              />
              <div className="wizard-actions">
                <button
                  className="button button--ghost"
                  onClick={() => setActiveStep('decoders')}
                  type="button"
                >
                  Back to decoder inputs
                </button>
                <button
                  className="button button--primary"
                  disabled={!selectedTrigger}
                  onClick={() => setActiveStep('configure')}
                  type="button"
                >
                  Continue to webhook editor
                </button>
              </div>
            </div>
          ) : null}

          {activeStep === 'configure' ? (
            <div className="stack">
              <SelectionSummary triggerLabel={selectedTrigger?.title} />
              <TriggerEditor
                editorState={editorState}
                onAddAddress={() =>
                  setEditorState((current) =>
                    current
                      ? {
                          ...current,
                          addresses: [...current.addresses, '']
                        }
                      : current
                  )
                }
                onAddHeader={() =>
                  setEditorState((current) =>
                    current
                      ? {
                          ...current,
                          headers: [...current.headers, createEmptyHeaderField()]
                        }
                      : current
                  )
                }
                onRemoveAddress={(index) =>
                  setEditorState((current) =>
                    current
                      ? {
                          ...current,
                          addresses: current.addresses.filter((_, addressIndex) => addressIndex !== index)
                        }
                      : current
                  )
                }
                onRemoveHeader={(headerId) =>
                  setEditorState((current) =>
                    current
                      ? {
                          ...current,
                          headers: current.headers.filter((header) => header.id !== headerId)
                        }
                      : current
                  )
                }
                onUpdateAddress={(index, value) =>
                  setEditorState((current) =>
                    current
                      ? {
                          ...current,
                          addresses: current.addresses.map((address, addressIndex) =>
                            addressIndex === index ? value : address
                          )
                        }
                      : current
                  )
                }
                onUpdateHeader={(headerId, field, value) =>
                  setEditorState((current) =>
                    current
                      ? {
                          ...current,
                          headers: current.headers.map((header) =>
                            header.id === headerId
                              ? {
                                  ...header,
                                  [field]: value
                                }
                              : header
                          )
                        }
                      : current
                  )
                }
                onUpdateState={updateEditorState}
                trigger={selectedTrigger}
              />
              <div className="wizard-actions">
                <button
                  className="button button--ghost"
                  onClick={() => setActiveStep('review')}
                  type="button"
                >
                  Back to trigger review
                </button>
                <button
                  className="button button--primary"
                  disabled={!editorState}
                  onClick={() => setActiveStep('yaml')}
                  type="button"
                >
                  Continue to YAML preview
                </button>
              </div>
            </div>
          ) : null}

          {activeStep === 'yaml' ? (
            <div className="stack">
              <SelectionSummary triggerLabel={selectedTrigger?.title} />
              <YamlPreview
                copyState={copyState}
                onCopy={handleCopy}
                {...(yamlResult.error ? { error: yamlResult.error } : {})}
                {...(yamlResult.yaml ? { yaml: yamlResult.yaml } : {})}
              />
              <div className="wizard-actions">
                <button
                  className="button button--ghost"
                  onClick={() => setActiveStep('configure')}
                  type="button"
                >
                  Back to webhook editor
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function createSourceId(file: File): string {
  return `${file.name}-${file.lastModified}-${file.size}`;
}

function createWizardSteps(options: {
  activeStep: WizardStepId;
  hasSelectedTrigger: boolean;
  hasSubmittedInput: boolean;
  hasYamlContext: boolean;
}): WizardStepDefinition[] {
  return [
    {
      id: 'source',
      label: 'Transaction source',
      description: 'Paste the tx id or explorer link so the app can normalize and probe it.',
      isVisited: hasReachedStep(options.activeStep, 'source')
    },
    {
      id: 'decoders',
      label: 'Optional decoders',
      description: 'Add ABI files or signature lists when you want richer decoding.',
      isOptional: true,
      isVisited: hasReachedStep(options.activeStep, 'decoders')
    },
    {
      id: 'review',
      label: 'Review receipt',
      description: options.hasSubmittedInput
        ? 'Confirm the right network and pick the trigger to keep.'
        : 'Analyze the transaction to unlock review.',
      isDisabled: !options.hasSubmittedInput,
      isVisited: hasReachedStep(options.activeStep, 'review')
    },
    {
      id: 'configure',
      label: 'Configure webhook',
      description: options.hasSelectedTrigger
        ? 'Tune the request payload, headers, and addresses.'
        : 'Select a trigger before editing.',
      isDisabled: !options.hasSelectedTrigger,
      isVisited: hasReachedStep(options.activeStep, 'configure')
    },
    {
      id: 'yaml',
      label: 'YAML output',
      description: options.hasYamlContext
        ? 'Preview, validate, and copy the generated file.'
        : 'Finish the webhook editor before previewing YAML.',
      isDisabled: !options.hasYamlContext,
      isVisited: hasReachedStep(options.activeStep, 'yaml')
    }
  ];
}

function hasReachedStep(activeStep: WizardStepId, candidateStep: WizardStepId): boolean {
  return wizardStepOrder.indexOf(activeStep) >= wizardStepOrder.indexOf(candidateStep);
}

function isWizardStepId(value: string): value is WizardStepId {
  return value === 'source' ||
    value === 'decoders' ||
    value === 'review' ||
    value === 'configure' ||
    value === 'yaml';
}

function SelectionSummary(props: {
  triggerLabel: string | undefined;
}): JSX.Element | null {
  if (!props.triggerLabel) {
    return null;
  }

  return (
    <section className="panel selection-summary">
      <p className="eyebrow">Current selection</p>
      <p className="selection-summary__label">{props.triggerLabel}</p>
    </section>
  );
}
