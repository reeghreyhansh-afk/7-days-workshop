import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

const app = express();
const port = Number(process.env.PORT || 8787);
const isProduction = process.env.CASHFREE_ENV === 'production';
const cashfreeBaseUrl = isProduction ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
const apiVersion = '2025-01-01';
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const receiptFrom = process.env.RECEIPT_FROM || 'contact@reeghdesign.com';

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

async function getRegistration(orderId) {
  const registrationUrl = `${supabaseUrl}/rest/v1/registrations?cashfree_order_id=eq.${encodeURIComponent(orderId)}&limit=1`;
  const supabaseResponse = await fetch(`${registrationUrl}&select=full_name,email,payment_status,receipt_sent_at`, {
    headers: supabaseHeaders(),
  });
  if (!supabaseResponse.ok) {
    const fallbackResponse = await fetch(`${registrationUrl}&select=full_name,email,payment_status`, {
      headers: supabaseHeaders(),
    });
    if (!fallbackResponse.ok) {
      const data = await fallbackResponse.json().catch(() => ({}));
      throw new Error(data.message || 'Unable to find registration');
    }
    const fallbackRegistrations = await fallbackResponse.json();
    return fallbackRegistrations[0];
  }
  const registrations = await supabaseResponse.json();
  return registrations[0];
}

function receiptTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP receipt email credentials are not configured');
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendReceiptEmail(registration, orderId) {
  await receiptTransporter().sendMail({
    from: `RéEGH Workshop <${receiptFrom}>`,
    to: registration.email,
    subject: 'Payment receipt - RéEGH Generative AI Workshop',
    text: `Hi ${registration.full_name},\n\nYour payment of ₹10 for the Design in Generative AI & Research in LLM 7-Day Intensive Workshop was successful.\n\nOrder ID: ${orderId}\nPayment status: PAID\n\nThank you,\nRéEGH`,
    html: `<p>Hi ${registration.full_name},</p><p>Your payment of <strong>₹10</strong> for the <strong>Design in Generative AI &amp; Research in LLM 7-Day Intensive Workshop</strong> was successful.</p><p><strong>Order ID:</strong> ${orderId}<br /><strong>Payment status:</strong> PAID</p><p>Thank you,<br />RéEGH</p>`,
  });
}

async function markReceiptSent(orderId) {
  const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/registrations?cashfree_order_id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ receipt_sent_at: new Date().toISOString() }),
  });
  if (!supabaseResponse.ok) {
    const data = await supabaseResponse.json().catch(() => ({}));
    throw new Error(data.message || 'Unable to mark receipt as sent');
  }
}

async function markRegistrationPaid(orderId) {
  const registration = await getRegistration(orderId);
  if (!registration) throw new Error('Registration not found for paid order');
  if (registration.payment_status !== 'paid') {
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
  if (!registration.receipt_sent_at) {
    try {
      await sendReceiptEmail(registration, orderId);
      await markReceiptSent(orderId);
    } catch (error) {
      console.error(`Unable to send receipt for order ${orderId}:`, error);
    }
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
        order_amount: 10,
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
    const orderId = request.params.orderId;
    const cashfreeResponse = await fetch(`${cashfreeBaseUrl}/orders/${encodeURIComponent(orderId)}`, {
      headers: cashfreeHeaders(),
    });
    const data = await cashfreeResponse.json();
    if (!cashfreeResponse.ok) return response.status(cashfreeResponse.status).json({ error: data.message || 'Cashfree order lookup failed' });
    let status = data.order_status;
    let paid = status === 'PAID';
    if (!paid) {
      const paymentsResponse = await fetch(`${cashfreeBaseUrl}/orders/${encodeURIComponent(orderId)}/payments`, {
        headers: cashfreeHeaders(),
      });
      if (paymentsResponse.ok) {
        const payments = await paymentsResponse.json();
        paid = Array.isArray(payments) && payments.some(payment => payment.payment_status === 'SUCCESS');
        if (paid) status = 'PAID';
      }
    }
    if (!paid) {
      const registration = await getRegistration(orderId);
      paid = registration?.payment_status === 'paid';
      if (paid) status = 'PAID';
    }
    if (paid) await markRegistrationPaid(data.order_id || orderId);
    return response.json({ orderId: data.order_id || orderId, paid, status });
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
