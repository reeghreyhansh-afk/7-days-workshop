import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import crypto from 'node:crypto';

const app = express();
const port = Number(process.env.PORT || 8787);
const isProduction = process.env.CASHFREE_ENV === 'production';
const cashfreeBaseUrl = isProduction ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
const apiVersion = '2025-01-01';
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use('/api/cashfree-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

function cashfreeHeaders() {
  if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
    throw new Error('Cashfree credentials are not configured');
  }
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-api-version': apiVersion,
    'x-client-id': process.env.CASHFREE_CLIENT_ID,
    'x-client-secret': process.env.CASHFREE_CLIENT_SECRET,
  };
}

function supabaseHeaders() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase credentials are not configured');
  }
  return {
    apikey: supabaseServiceRoleKey,
    authorization: `Bearer ${supabaseServiceRoleKey}`,
    'content-type': 'application/json',
  };
}

async function saveRegistration(registration) {
  const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/registrations`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(registration),
  });
  if (!supabaseResponse.ok) {
    const data = await supabaseResponse.json().catch(() => ({}));
    throw new Error(data.message || 'Unable to save registration');
  }
}

async function markRegistrationPaid(orderId) {
  const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/registrations?cashfree_order_id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ payment_status: 'paid', paid_at: new Date().toISOString() }),
  });
  if (!supabaseResponse.ok) {
    const data = await supabaseResponse.json().catch(() => ({}));
    throw new Error(data.message || 'Unable to update registration');
  }
}

app.post('/api/create-order', async (request, response) => {
  try {
    const { fullName, email, whatsapp } = request.body;
    if (!fullName || !email || !whatsapp) {
      return response.status(400).json({ error: 'Name, email, and WhatsApp number are required' });
    }

    const customerPhone = String(whatsapp).replace(/\D/g, '').slice(-10);
    if (customerPhone.length !== 10) {
      return response.status(400).json({ error: 'Enter a valid 10-digit WhatsApp number' });
    }

    const orderId = `seven_days_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const returnUrl = process.env.CLIENT_ORIGIN
      ? `${process.env.CLIENT_ORIGIN}/?payment=complete&order_id=${orderId}`
      : undefined;
    await saveRegistration({
      full_name: String(fullName).slice(0, 100),
      email: String(email).slice(0, 100),
      whatsapp: customerPhone,
      profession: String(request.body.profession || '').slice(0, 100),
      city: String(request.body.city || '').slice(0, 100),
      participant_type: String(request.body.participantType || '').slice(0, 50),
      social_link: String(request.body.socialLink || '').slice(0, 300) || null,
      cashfree_order_id: orderId,
      payment_status: 'pending',
    });

    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders`, {
      method: 'POST',
      headers: { ...cashfreeHeaders(), 'x-idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: 1499,
        order_currency: 'INR',
        customer_details: {
          customer_id: orderId,
          customer_name: String(fullName).slice(0, 100),
          customer_email: String(email).slice(0, 100),
          customer_phone: customerPhone,
        },
        order_meta: returnUrl ? { return_url: returnUrl } : undefined,
        order_note: 'Seven-day Generative AI workshop registration',
      }),
    });
    const data = await cashfreeResponse.json();
    if (!cashfreeResponse.ok) return response.status(cashfreeResponse.status).json({ error: data.message || 'Cashfree order creation failed' });
    return response.json({ orderId: data.order_id, paymentSessionId: data.payment_session_id });
  } catch (error) {
    return response.status(500).json({ error: error.message || 'Unable to create payment order' });
  }
});

app.get('/api/verify-order/:orderId', async (request, response) => {
  try {
    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders/${encodeURIComponent(request.params.orderId)}`, {
      headers: cashfreeHeaders(),
    });
    const data = await cashfreeResponse.json();
    if (!cashfreeResponse.ok) return response.status(cashfreeResponse.status).json({ error: data.message || 'Cashfree order lookup failed' });
    const paid = data.order_status === 'PAID';
    if (paid) await markRegistrationPaid(data.order_id);
    return response.json({ orderId: data.order_id, paid, status: data.order_status });
  } catch (error) {
    return response.status(500).json({ error: error.message || 'Unable to verify payment' });
  }
});

app.post('/api/cashfree-webhook', async (request, response) => {
  const timestamp = request.header('x-webhook-timestamp');
  const signature = request.header('x-webhook-signature');
  const rawBody = request.body.toString('utf8');
  const expectedSignature = timestamp && process.env.CASHFREE_CLIENT_SECRET
    ? crypto.createHmac('sha256', process.env.CASHFREE_CLIENT_SECRET).update(timestamp + rawBody).digest('base64')
    : '';
  const signaturesMatch = signature && expectedSignature && Buffer.byteLength(signature) === Buffer.byteLength(expectedSignature)
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!signaturesMatch) {
    return response.status(401).send('Invalid webhook signature');
  }
  const webhook = JSON.parse(rawBody);
  const webhookOrderId = webhook.data?.order?.order_id;
  if (webhook.type === 'PAYMENT_SUCCESS_WEBHOOK' && webhookOrderId) {
    await markRegistrationPaid(webhookOrderId);
  }
  console.log('Cashfree webhook received:', webhook.type);
  return response.sendStatus(200);
});

export default app;

if (process.env.VERCEL !== '1') {
  app.listen(port, () => console.log(`Payment API listening on http://localhost:${port}`));
}
