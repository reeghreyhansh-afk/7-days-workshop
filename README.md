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
3. Set `VITE_CASHFREE_ENV` to the same environment as `CASHFREE_ENV` (`sandbox` for testing or `production` for live payments).
4. Create the `registrations` table in Supabase using the SQL below.
5. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
6. Configure SMTP with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `RECEIPT_FROM`. The receipt sender must be authorized by your email provider; use `contact@reeghdesign.com` for `SMTP_USER` and `RECEIPT_FROM`.
7. Run `npm run dev:all`.
8. Test the registration flow with Cashfree sandbox credentials.

For Vercel, leave `VITE_API_URL` unset so the browser uses same-origin `/api` routes. Add these variables in the Vercel project settings instead of committing them: `CASHFREE_ENV`, `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_ORIGIN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `RECEIPT_FROM`. Set `VITE_CASHFREE_ENV` to the same Cashfree environment, then redeploy. The Cashfree secret, Supabase service-role key, and SMTP password are used only by the Vercel API function.

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
	receipt_sent_at timestamptz,
	created_at timestamptz not null default now(),
	paid_at timestamptz
);

alter table registrations enable row level security;

-- Run this separately if the table already exists:
alter table registrations add column if not exists receipt_sent_at timestamptz;
```

Required before going live:

- Cashfree production App ID and Secret Key.
- A public HTTPS backend URL for `server/index.mjs`.
- The frontend URL in `CLIENT_ORIGIN` and whitelisted in Cashfree.
- Cashfree webhook URL: `https://YOUR-API-DOMAIN/api/cashfree-webhook`.
- A Supabase project with the `registrations` table above.
- Production legal pages, refund policy, contact details, and the final WhatsApp community link.

Never commit `.env` or expose `CASHFREE_CLIENT_SECRET` in frontend code. Cashfree recommends server-side order creation and server-side verification; only an order's `PAID` status should unlock the WhatsApp invitation.
