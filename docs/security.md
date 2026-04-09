# Security

## HMAC Signing

You can enable HMAC signing per webhook:

```yml
request:
  signing:
    enabled: true
    secretEnv: WEBHOOK_SIGNATURE_SECRET
    header: x-webhook-signature
```

The signature payload is:

```text
${x-webhook-timestamp}.${rawRequestBody}
```

## Recommendation

- Keep signing secrets in environment variables, not YAML.
- Use HTTPS receiver URLs in production.
- Treat `x-webhook-delivery-id` as an idempotency key.
- Rotate secrets by changing the environment variable and restarting the service.
