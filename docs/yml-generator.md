# YAML Generator

The static generator app helps you inspect a single VeChain transaction receipt,
review the webhook triggers it contains, and copy a ready-to-store YAML file.

The interface is grouped into a five-step wizard with a compact progress rail,
a single current-step summary, and an optional decoder step:

- `Transaction source`
- `Optional decoders`
- `Review receipt`
- `Configure webhook`
- `YAML output`

## Local Commands

Start the app in development mode:

```bash
npm run app:dev
```

Build the GitHub Pages artifact:

```bash
npm run app:build
```

Preview the production build:

```bash
npm run app:preview
```

## Supported Inputs

The app accepts:

- a bare VeChain transaction id
- a transaction URL that contains the transaction id
- a deep link such as `?txid=0x...`
- ABI JSON files
- newline-based signature lists

### ABI JSON

ABI JSON can be:

- an ABI array
- a single ABI fragment object
- an object with an `abi` array

Use ABI JSON when you want the app to:

- decode event parameters precisely
- generate event webhook YAML with `match.event.abi.inline`

### Signature Lists

Signature lists use one declaration per line. The app accepts forms such as:

```text
Ping(address,uint256)
transfer(address,uint256)
event Transfer(address,address,uint256)
function approve(address,uint256)
```

Signature lists are enough to:

- label event topics
- decode clause calldata for known functions

When a signature list is not enough to decode an event completely, the app also
queries `https://sig.api.vechain.energy` for a matching event ABI. If the
public lookup still cannot restore indexed metadata, the app shows an
instructive preview-only message that tells you to upload the ABI JSON that
defines the event.

## Network Detection

When you submit a transaction id, the app probes both:

- `https://mainnet.vechain.org`
- `https://testnet.vechain.org`

Transaction details are loaded from the public node with `?pending=true`, which
keeps confirmed transaction bodies available on the public endpoint. The app
prefers any network hinted by the pasted URL, then lets you override the
selected network manually. If a transaction exists but the receipt is still
missing, the app keeps the result in a pending state and tells you to retry once
the transaction finalizes.

The following explorer URLs are supported because the app extracts the hash from
the path before it probes the nodes:

- `https://vechainstats.com/transaction/<txid>/`
- `https://explore.vechain.org/transactions/<txid>`
- `https://explore-testnet.vechain.org/transactions/<txid>`

After a successful analysis, the app rewrites the browser URL to `?txid=<hash>`
so the current result page is easy to share or bookmark.

## Generated YAML Scope

The generator keeps the existing webhook schema unchanged and only writes the
sections it can produce safely in v1:

- `version`
- `id`
- `enabled`
- optional `description`
- `match`
- `request`

It does not generate:

- `filters`
- `decode`

The advanced editor lets you change:

- webhook id
- enabled flag
- description
- match addresses
- HTTP method
- request URL
- content type
- headers
- body template
- optional signing configuration

## Deployment

`.github/workflows/deploy-pages.yml` builds `apps/yml-generator/` and publishes
`apps/yml-generator/dist/` to GitHub Pages on pushes to the repository's default
branch and on manual dispatch.
