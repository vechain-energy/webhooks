# Agent Guide

This repository is the public `vechain.webhooks` project: a self-hosted VeChain webhook processor configured by YAML and launched with Docker Compose.

Keep it focused on the public OSS runtime. Do not add Builder-hosted service behavior, private migration notes, or internal platform assumptions.

## Repo Map

- `src/config`: YAML loading, schema validation, ABI resolution
- `src/network`: Thor client access and block subscriptions
- `src/matchers`: candidate derivation, matcher compilation, decoding, filters
- `src/delivery`: request rendering, signing, outbound delivery
- `src/runtime`: processor orchestration, replay, live block handling
- `src/http`: `/health` and `/ready`
- `src/cli`: `validate`, `print-rules`, `dry-run`
- `config/runtime.yml`: runtime settings
- `config/webhooks/`: public webhook definitions
- `config/abis/`: ABI files for event webhooks
- `examples/`: sample webhook YAML and receiver
- `fixtures/`: dry-run fixtures
- `test/`: unit and integration coverage
- `docs/`: public operator and maintainer documentation

## Invariants

- One network per process.
- The processor is stateless in v1 and may redeliver events after replay.
- YAML is the public configuration surface.
- `docker compose up --build` is the default operator entrypoint.

## Working Rules

- Do not edit `dist/` manually. Rebuild generated output with `npm run build`.
- Do not commit secrets or change `.env` unless the task explicitly requires local secret setup.
- Keep sample YAML, fixtures, and public docs aligned with schema, template, CLI, Compose, and delivery changes.
- Keep error messages instructive and action-oriented.
- Treat `.github/workflows/ci.yml` as the source of truth for required verification.

## Required Verification

Run these before claiming completion:

```bash
npm run lint
npm run typecheck
npm test
docker build .
```

Run these when the change touches config, schema, rules, CLI behavior, templates, or fixtures:

```bash
npm run validate -- --config ./config/runtime.yml
npm run print-rules -- --config ./config/runtime.yml
npm run dry-run -- --config ./config/runtime.yml --webhook transfer-alert --fixture ./fixtures/transfer.json
```

## Doc Update Triggers

Update the matching docs whenever you change:

- config schema or webhook fields: `docs/configuration.md`
- template context or rendering behavior: `docs/templates.md`
- signing or delivery header behavior: `docs/security.md`
- quick start, Compose flow, or public doc links: `README.md`
- agent workflows or verification expectations: `docs/agents.md`

See `docs/agents.md` for the deeper workflow guide.
