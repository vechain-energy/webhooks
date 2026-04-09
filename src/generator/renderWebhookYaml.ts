import YAML from 'yaml';

import type { AnalyzedTriggerOption, RenderWebhookYamlResult, WebhookEditorState } from './types.js';

export function renderWebhookYaml(options: {
  editorState: WebhookEditorState;
  trigger: AnalyzedTriggerOption;
}): RenderWebhookYamlResult {
  const { editorState, trigger } = options;
  const requestUrl = editorState.requestUrl.trim();

  if (!requestUrl) {
    return {
      error:
        'Add the destination request URL before you copy the YAML file so the webhook knows where to deliver the payload.'
    };
  }

  if (
    trigger.kind === 'event' &&
    (!trigger.eventDescriptor || !trigger.eventDescriptor.fragment)
  ) {
    return {
      error:
        trigger.selectionMessage ??
        'Upload the ABI JSON that defines this event so the generator can embed match.event.abi.inline before it writes the YAML file.'
    };
  }

  const normalizedAddresses = dedupeAddresses(editorState.addresses);
  const config: Record<string, unknown> = {
    version: 1,
    id: editorState.id.trim() || 'generated-webhook',
    enabled: editorState.enabled,
    match: createMatchSection(trigger, normalizedAddresses),
    request: createRequestSection(editorState, requestUrl)
  };

  if (editorState.description.trim()) {
    config.description = editorState.description.trim();
  }

  return {
    yaml: YAML.stringify(config, {
      blockQuote: 'literal',
      defaultStringType: 'PLAIN'
    }).trim()
  };
}

function createMatchSection(
  trigger: AnalyzedTriggerOption,
  addresses: string[]
): Record<string, unknown> {
  const match: Record<string, unknown> = {
    kind: trigger.kind
  };

  if (addresses.length) {
    match.addresses = addresses;
  }

  if (trigger.kind === 'event' && trigger.eventDescriptor?.fragment) {
    match.event = {
      name: trigger.eventDescriptor.name,
      abi: {
        inline: trigger.eventDescriptor.fragment
      }
    };
  }

  return match;
}

function createRequestSection(
  editorState: WebhookEditorState,
  requestUrl: string
): Record<string, unknown> {
  const headers = editorState.headers.reduce<Record<string, string>>((current, header) => {
    const key = header.key.trim();
    const value = header.value.trim();
    if (!key || !value) {
      return current;
    }

    current[key] = value;
    return current;
  }, {});
  const request: Record<string, unknown> = {
    method: editorState.requestMethod,
    url: requestUrl
  };

  if (Object.keys(headers).length > 0) {
    request.headers = headers;
  }

  if (editorState.requestContentType.trim()) {
    request.contentType = editorState.requestContentType.trim();
  }

  if (editorState.requestBody.trim()) {
    request.body = editorState.requestBody.trim();
  }

  if (editorState.signingEnabled) {
    request.signing = {
      enabled: true,
      secretEnv: editorState.signingSecretEnv.trim() || 'WEBHOOK_SIGNATURE_SECRET',
      ...(editorState.signingHeader.trim()
        ? { header: editorState.signingHeader.trim() }
        : {})
    };
  }

  return request;
}

function dedupeAddresses(addresses: string[]): string[] {
  const seen = new Set<string>();

  return addresses.reduce<string[]>((current, address) => {
    const normalizedAddress = address.trim().toLowerCase();
    if (!normalizedAddress || seen.has(normalizedAddress)) {
      return current;
    }

    seen.add(normalizedAddress);
    current.push(normalizedAddress);
    return current;
  }, []);
}
