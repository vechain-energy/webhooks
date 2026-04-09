# Templates

Request templates use Handlebars in strict mode.

## Available Context

- `decoded.*`
- `event.*`
- `meta.*`
- `network.name`
- `webhook.id`

## Example

```yml
request:
  method: POST
  url: https://example.com/hooks/{{webhook.id}}
  headers:
    x-network: "{{network.name}}"
  contentType: application/json
  body: |
    {
      "txId": "{{meta.txID}}",
      "from": "{{decoded.from}}",
      "to": "{{decoded.to}}"
    }
```

## Missing Values

Templates are compiled in strict mode. If you reference a missing field, request rendering fails so you can fix the template instead of silently sending incomplete payloads.
