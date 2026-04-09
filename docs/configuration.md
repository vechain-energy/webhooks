# Configuration

## Runtime

`config/runtime.yml` defines network, replay, delivery, and HTTP settings.

```yml
version: 1
network: test
nodeUrl: https://node-testnet.vechain.energy
server:
  port: 8080
processing:
  confirmations: 12
  replayWindowBlocks: 64
delivery:
  requestTimeoutMs: 10000
  maxAttempts: 5
  initialBackoffMs: 1000
  maxBackoffMs: 16000
  defaultHeaders: {}
  signing:
    defaultEnabled: false
    header: x-webhook-signature
logLevel: info
```

## Webhooks

Each file in `config/webhooks/*.yml` defines one webhook.

### Match Kinds

- `event`: matches contract events by topic hash and optional emitter addresses.
- `transfer`: matches native transfers by sender or recipient address.
- `transaction`: matches transactions by origin address.
- `clause`: matches clauses by `to` address.

### Event ABI Sources

Event webhooks must define exactly one ABI source:

- `match.event.abi.inline`
- `match.event.abi.file`

If you define neither or both, validation fails with an instructive error.

### Filters

Supported operators:

- `eq`
- `neq`
- `lt`
- `lte`
- `gt`
- `gte`
- `empty`
- `notEmpty`
- `in`
- `notIn`

For simple field names, the processor looks in `decoded`, then `event`, then `meta`.
For nested fields, use paths such as `decoded.amount` or `meta.txID`.
