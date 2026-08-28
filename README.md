# Seven Days Workshop

A premium React/Vite registration experience for **Design in Generative AI & Research in LLM**.

## Run

```bash
npm install
npm run dev
```

## Cashfree payment setup

The payment flow uses Cashfree hosted checkout. The browser submits the registration details to the API, the API creates the Cashfree order, and the success screen is shown only after the API verifies that the order status is `PAID`.

1. Copy `.env.example` to `.env`.
2. In the Cashfree Merchant Dashboard, create sandbox API keys and set `CASHFREE_CLIENT_ID` and `CASHFREE_CLIENT_SECRET`.
3. Run `npm run dev:all`.
4. Test the registration flow with Cashfree sandbox credentials.

Required before going live:

- Cashfree production App ID and Secret Key.
- A public HTTPS backend URL for `server/index.mjs`.
- The frontend URL in `CLIENT_ORIGIN` and whitelisted in Cashfree.
- Cashfree webhook URL: `https://YOUR-API-DOMAIN/api/cashfree-webhook`.
- A database (Supabase, PostgreSQL, or similar) to persist registrations and paid status. The current API verifies orders but does not yet persist registrations.
- Production legal pages, refund policy, contact details, and the final WhatsApp community link.

Never commit `.env` or expose `CASHFREE_CLIENT_SECRET` in frontend code. Cashfree recommends server-side order creation and server-side verification; only an order's `PAID` status should unlock the WhatsApp invitation.
