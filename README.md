# `vechain.webhooks`

Self-hosted VeChain webhooks driven by YAML config and launched with Docker Compose.

The repository also ships a static GitHub Pages app that can inspect a single
transaction receipt and generate a webhook YAML file from detected triggers.

## What It Does

- Watches VeChain blocks for a single network per process.
- Replays a configurable finalized block window on startup.
- Matches `event`, `transfer`, `transaction`, and `clause` rules from `config/webhooks/*.yml`.
- Renders outgoing webhook requests from templates.
- Supports optional HMAC signing.
- Exposes `/health` and `/ready`.

## Quick Start

1. Install dependencies.

```bash
npm install
```

2. Review `config/runtime.yml`.

3. Review or replace the sample files in `config/webhooks/`.

4. Set any required secrets.

```bash
cp .env.example .env
```

5. Start the processor.

```bash
docker compose up --build
```

6. If you want to test against the bundled sample receiver:

```bash
docker compose --profile receiver up --build
```

## YAML Generator App

Run the GitHub Pages app locally:

```bash
npm run app:dev
```

Build the static app:

```bash
npm run app:build
```

Preview the production build locally:

```bash
npm run app:preview
```

The app lives in `apps/yml-generator/` and is deployed as the repository's
GitHub Pages site root by `.github/workflows/deploy-pages.yml`.

The UI now uses a five-step wizard with a compact progress rail, a focused
current-step summary, and an optional decoder step so the workflow stays
manageable on mobile and long receipts do not overwhelm the page:

- transaction source
- optional decoders
- review receipt
- configure webhook
- YAML output

What the app accepts:

- a bare transaction id or transaction URL
- ABI JSON files for full event decoding and inline event YAML generation
- plain-text signature lists for best-effort function decoding and event labeling
- shareable deep links such as `?txid=0x...`, which auto-run the analysis on load

Current limitations:

- event YAML generation needs a full event ABI, either from your upload or from the public `sig.api.vechain.energy` lookup
- raw event signatures stay preview-only when neither your upload nor the public lookup can restore indexed metadata
- the app does not generate filters or decode hints in v1

## CLI

Validate config:

```bash
npm run validate -- --config ./config/runtime.yml
```

Preview compiled rules:

```bash
npm run print-rules -- --config ./config/runtime.yml
```

Render a request from a fixture:

```bash
npm run dry-run -- --config ./config/runtime.yml --webhook transfer-alert --fixture ./fixtures/transfer.json
```

## Delivery Model

- The processor is stateless by design in v1.
- On cold start it replays `processing.replayWindowBlocks`.
- On restart, duplicate deliveries are possible.
- Receivers should treat `x-webhook-delivery-id` as an idempotency key.

## Config Layout

- `config/runtime.yml`: processor runtime settings.
- `config/webhooks/*.yml`: one file per webhook.
- `config/abis/*.json`: optional ABI artifacts referenced by event webhooks.

## Docs

- [Agent Guide](./AGENTS.md)
- [Agent Workflows](./docs/agents.md)
- [Configuration](./docs/configuration.md)
- [Templates](./docs/templates.md)
- [Security](./docs/security.md)
- [YAML Generator](./docs/yml-generator.md)

The repository also includes checked-in agent instructions so coding agents and operator agents can work from the same public guidance.
