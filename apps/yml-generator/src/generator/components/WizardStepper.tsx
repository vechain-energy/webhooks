import type { JSX } from 'react';

export interface WizardStepDefinition {
  description: string;
  id: string;
  isDisabled?: boolean;
  isOptional?: boolean;
  isVisited?: boolean;
  label: string;
}

type WizardStepStatus = 'available' | 'complete' | 'current' | 'locked';

export function WizardStepper(props: {
  activeStepId: string;
  onChange: (stepId: string) => void;
  steps: WizardStepDefinition[];
}): JSX.Element {
  const activeStepIndex = Math.max(
    props.steps.findIndex((step) => step.id === props.activeStepId),
    0
  );
  const activeStep = props.steps[activeStepIndex] ?? null;
  const nextUnlockedStep = props.steps
    .slice(activeStepIndex + 1)
    .find((step) => step.isDisabled !== true);

  return (
    <section
      aria-labelledby="wizard-progress-heading"
      className="wizard-nav panel stack"
    >
      <div className="wizard-nav__header">
        <div className="wizard-nav__copy">
          <p className="eyebrow">Progress</p>
          <h2 id="wizard-progress-heading">Move from transaction receipt to ready-to-store YAML.</h2>
          <p className="muted">
            Keep the top rail for orientation, and use each panel to finish one clear decision at
            a time.
          </p>
        </div>
        <div className="wizard-nav__status">
          <p className="wizard-nav__counter">
            Step {activeStepIndex + 1} of {props.steps.length}
          </p>
          <div
            aria-hidden="true"
            className={`wizard-progress wizard-progress--${activeStepIndex + 1}`}
          />
        </div>
      </div>

      <ol className="wizard-steps">
        {props.steps.map((step, index) => {
          const status = getWizardStepStatus({
            activeStepId: props.activeStepId,
            step
          });
          const statusId = `wizard-step-status-${step.id}`;

          return (
            <li className="wizard-steps__item" key={step.id}>
              <button
                aria-current={props.activeStepId === step.id ? 'step' : undefined}
                aria-describedby={statusId}
                className={`wizard-step wizard-step--${status}`}
                disabled={step.isDisabled === true}
                onClick={() => props.onChange(step.id)}
                type="button"
              >
                <span className="wizard-step__index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="wizard-step__content">
                  <span className="wizard-step__label">{step.label}</span>
                  <span
                    className={`wizard-step__status wizard-step__status--${status}`}
                    id={statusId}
                  >
                    {getWizardStepStatusLabel({
                      isOptional: step.isOptional === true,
                      status
                    })}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {activeStep ? (
        <div aria-live="polite" className="wizard-summary" role="status">
          <div className="wizard-summary__copy">
            <p className="eyebrow">Current step</p>
            <h3>{activeStep.label}</h3>
            <p className="muted">{activeStep.description}</p>
          </div>
          <div className="wizard-summary__meta">
            {activeStep.isOptional ? (
              <p className="wizard-summary__hint">
                Optional step. Skip uploads here when the built-in signature lookup already decodes
                the receipt well enough.
              </p>
            ) : null}
            <p className="wizard-summary__next">
              {nextUnlockedStep
                ? `After this: ${nextUnlockedStep.label}.`
                : 'Final step. Review the generated YAML and copy it when it looks right.'}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getWizardStepStatus(options: {
  activeStepId: string;
  step: WizardStepDefinition;
}): WizardStepStatus {
  if (options.step.isDisabled === true) {
    return 'locked';
  }

  if (options.step.id === options.activeStepId) {
    return 'current';
  }

  if (options.step.isVisited === true && options.step.id !== options.activeStepId) {
    return 'complete';
  }

  return 'available';
}

function getWizardStepStatusLabel(options: {
  isOptional: boolean;
  status: WizardStepStatus;
}): string {
  switch (options.status) {
    case 'available':
      return options.isOptional ? 'Optional' : 'Ready';
    case 'complete':
      return 'Done';
    case 'current':
      return 'Current';
    case 'locked':
      return 'Locked';
  }
}
