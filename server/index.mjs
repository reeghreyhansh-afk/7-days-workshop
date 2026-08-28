import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import crypto from 'node:crypto';

const app = express();
const port = Number(process.env.PORT || 8787);
const isProduction = process.env.CASHFREE_ENV === 'production';
const cashfreeBaseUrl = isProduction ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
const apiVersion = '2025-01-01';

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
    return response.json({ orderId: data.order_id, paid: data.order_status === 'PAID', status: data.order_status });
  } catch (error) {
    return response.status(500).json({ error: error.message || 'Unable to verify payment' });
  }
});

app.post('/api/cashfree-webhook', (request, response) => {
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
  console.log('Cashfree webhook received:', JSON.parse(rawBody).type);
  return response.sendStatus(200);
});

app.listen(port, () => console.log(`Payment API listening on http://localhost:${port}`));
