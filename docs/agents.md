# Agents

This guide is for agents working inside the public `vechain.webhooks` repository.

Use it when you need to change code, update public docs, author webhook YAML, or verify the Docker flow without relying on private repo context.

## Repo Layout

- `src/config`: `loadProjectConfig.ts`, `schema.ts`, `resolveAbi.ts`
- `src/network`: `thorClient.ts`, `blockSubscription.ts`, `resolveSubscriptionUrl.ts`
- `src/matchers`: `candidates.ts`, `compileMatchers.ts`, `decode.ts`, `filter.ts`
- `src/delivery`: `renderRequest.ts`, `signRequest.ts`, `sendWebhook.ts`
- `src/runtime`: `processor.ts`
- `src/http`: `createServer.ts`
- `src/cli`: `index.ts`
- `config/runtime.yml`, `config/webhooks/`, `config/abis/`
- `examples/webhooks/`, `examples/receiver/`
- `fixtures/transfer.json`
- `test/unit/`, `test/integration/`
- `.github/workflows/ci.yml`

## Change Boundaries

Use these rules to scope the work correctly:

- Config-only change:
  - editing existing YAML values in `config/webhooks/` or `config/runtime.yml`
  - requires config validation, rule inspection, and dry-run verification
  - update docs only if the public examples or operator instructions changed
- Code plus tests:
  - any change under `src/`
  - requires test coverage updates in `test/unit/` or `test/integration/`
- Code plus docs:
  - schema changes, template context changes, CLI flag changes, delivery header or signing changes, or Docker workflow changes
  - requires matching updates to `README.md` and the relevant docs file

## Workflow: Change Runtime Behavior

Use this when changing how the processor loads config, subscribes to blocks, matches candidates, renders requests, delivers webhooks, or reports health.

1. Change the smallest relevant area first:
   - config loading and schema: `src/config`
   - block fetching and subscriptions: `src/network`
   - candidate derivation and matching: `src/matchers`
   - request rendering, signing, retries: `src/delivery`
   - replay and live processing: `src/runtime/processor.ts`
   - health and readiness responses: `src/http/createServer.ts`
2. Update or add tests for the changed behavior:
   - unit tests for helpers, schema, filters, rendering, signing
   - integration tests for processor flow, replay, subscriptions, delivery
3. If the behavior changes the public surface, update docs in the same change:
   - config behavior: `docs/configuration.md`
   - template behavior: `docs/templates.md`
   - delivery or signing behavior: `docs/security.md`
   - operator flow or doc discovery: `README.md`

## Workflow: Change Config, Schema, or Template Behavior

Use this when adding or changing webhook fields, runtime settings, filters, template context, CLI behavior, or sample configs.

1. Update the implementation in the relevant source files:
   - schema and config loading: `src/config/schema.ts`, `src/config/loadProjectConfig.ts`
   - template rendering: `src/delivery/renderRequest.ts`
   - CLI flags or output: `src/cli/index.ts`
2. Keep public samples aligned:
   - `config/runtime.yml`
   - `config/webhooks/*.yml`
   - `config/abis/*.json` if event ABI usage changes
   - `examples/webhooks/transfer-alert.yml`
   - `fixtures/transfer.json` if dry-run input expectations change
3. Update the matching docs in the same change:
   - `README.md` for operator-facing entrypoints
   - `docs/configuration.md` for schema or validation behavior
   - `docs/templates.md` for template context or strict rendering behavior
   - `docs/security.md` for signing or delivery headers
4. Re-run the config workflows after the edits:

```bash
npm run validate -- --config ./config/runtime.yml
npm run print-rules -- --config ./config/runtime.yml
npm run dry-run -- --config ./config/runtime.yml --webhook transfer-alert --fixture ./fixtures/transfer.json
```

## Workflow: Author or Debug a Webhook Config

Use this when the task is limited to webhook YAML, sample configs, or operator verification.

1. Check the active runtime target in `config/runtime.yml`.
   - The checked-in sample currently points at VeChain mainnet.
   - Starting the processor can deliver real webhook traffic if the loaded config matches live activity.
2. Validate the project config:

```bash
npm run validate -- --config ./config/runtime.yml
```

3. Inspect the compiled rules:

```bash
npm run print-rules -- --config ./config/runtime.yml
```

4. Preview a rendered request from the bundled fixture:

```bash
npm run dry-run -- --config ./config/runtime.yml --webhook transfer-alert --fixture ./fixtures/transfer.json
```

5. Start the bundled receiver when you need end-to-end local delivery visibility:

```bash
docker compose --profile receiver up --build
```

6. Use `docker compose down` when the verification run is complete.

## Workflow: Pre-Ship Verification

Run commands in this order before claiming the work is complete:

```bash
npm run lint
npm run typecheck
npm test
npm run validate -- --config ./config/runtime.yml
npm run print-rules -- --config ./config/runtime.yml
npm run dry-run -- --config ./config/runtime.yml --webhook transfer-alert --fixture ./fixtures/transfer.json
docker build .
```

If the change did not touch config, schema, templates, CLI behavior, or fixtures, you can skip the three config-specific commands. If the change touched Docker or end-to-end delivery behavior, also run:

```bash
docker compose --profile receiver up --build
```

## Troubleshooting

- Node version mismatch:
  - the repo expects Node `24.x`
  - if local commands fail unexpectedly, switch to Node 24 before debugging the code
- Missing signing secret:
  - local Compose injects `WEBHOOK_SIGNATURE_SECRET` with a default fallback
  - if a task changes signing behavior, verify the receiver still gets `x-webhook-signature`
- Live-network assumptions:
  - `config/runtime.yml` currently targets VeChain mainnet
  - prefer `dry-run` before Compose when you only need to verify rendering or filters
- Replay duplicates:
  - the processor replays a finalized block window on startup
  - receivers must treat `x-webhook-delivery-id` as the idempotency key
- Receiver profile:
  - the bundled receiver logs request headers and bodies to stdout on port `3000`
  - it is the fastest way to confirm payload shape and headers without an external endpoint

## CI Source of Truth

The required repo gates come from `.github/workflows/ci.yml`:

```bash
npm ci
npm run lint
npm run typecheck
npm test
docker build .
```

Do not loosen the local verification guidance below that baseline.
