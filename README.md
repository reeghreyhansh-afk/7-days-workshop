# Seven Days Workshop

A premium React/Vite registration experience for **Design in Generative AI & Research in LLM**.

## Run

```bash
npm install
npm run dev
```

## Production wiring

The current flow is intentionally frontend-only and labels the payment step as Razorpay test mode. Connect the registration submit to a server endpoint that:

1. Creates a Razorpay order using `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Stores the registration in Supabase with `payment_status = pending`.
3. Verifies the Razorpay signature/webhook server-side before changing status to `paid`.
4. Returns the verified registration id to the success page.

Keep these values server-side: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `WHATSAPP_GROUP_LINK`. Replace the placeholder logo in `public/brand/` and replace `WHATSAPP_GROUP_LINK` only in the verified success flow. Add real company contact details, Terms, Privacy Policy, and Refund/Cancellation Policy before launch.
