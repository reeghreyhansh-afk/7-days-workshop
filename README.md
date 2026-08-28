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
3. Create the `registrations` table in Supabase using the SQL below.
4. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
5. Run `npm run dev:all`.
6. Test the registration flow with Cashfree sandbox credentials.

```sql
create table registrations (
	id uuid primary key default gen_random_uuid(),
	full_name text not null,
	email text not null,
	whatsapp text not null,
	profession text not null,
	city text not null,
	participant_type text not null,
	social_link text,
	cashfree_order_id text unique,
	payment_status text not null default 'pending',
	created_at timestamptz not null default now(),
	paid_at timestamptz
);

alter table registrations enable row level security;
```

Required before going live:

- Cashfree production App ID and Secret Key.
- A public HTTPS backend URL for `server/index.mjs`.
- The frontend URL in `CLIENT_ORIGIN` and whitelisted in Cashfree.
- Cashfree webhook URL: `https://YOUR-API-DOMAIN/api/cashfree-webhook`.
- A Supabase project with the `registrations` table above.
- Production legal pages, refund policy, contact details, and the final WhatsApp community link.

Never commit `.env` or expose `CASHFREE_CLIENT_SECRET` in frontend code. Cashfree recommends server-side order creation and server-side verification; only an order's `PAID` status should unlock the WhatsApp invitation.
