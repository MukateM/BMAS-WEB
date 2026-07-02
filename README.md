# BMAS-WEB

Company site.

## Build assets

Run `npm install` once, then use `npm run build` to regenerate:

- `assets/tailwind.css`
- `assets/supabase-client.js`

## Resource Store payment secrets

The Supabase Edge Functions for paid resources require these production secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LIPILA_API_KEY`
- `LIPILA_API_BASE_URL`
- `PAYMENT_CALLBACK_TOKEN`
- `PAYMENT_CALLBACK_URL`

`PAYMENT_CALLBACK_TOKEN` is required. `document-checkout` appends it to the Lipila callback URL, and `payment-callback` rejects callbacks that do not include the same token.

For stronger paid-status verification, also configure `LIPILA_VERIFY_URL` as a GET endpoint template. It may include `{reference}` and `{providerReference}` placeholders, for example:

`https://api.lipila.dev/api/v1/collections/{providerReference}`
