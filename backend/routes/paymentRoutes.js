const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const webpush = require('web-push');
const caktoService = require('../services/caktoService');
const firebaseAdminService = require('../services/firebaseAdminService');
const mercadopagoService = require('../services/mercadopagoService');

// ── VAPID Config ──────────────────────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || 'BLqLhw2gqsuw7dX15HJmL9mx652r3FBViKcbjTYsvPf1BNGOiORuW8mAeoQHnb9d0h3ZB0XacxfriFq-FHm6FPY';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'LWg0Cq5ycqYL6zJcF6-fYJqKgbAIKN7ZuUSHOgXGQ9M';

webpush.setVapidDetails('mailto:admin@rifababygo.com', VAPID_PUBLIC, VAPID_PRIVATE);

// In-memory store for push subscriptions (resets on server restart — good enough for 1 admin)
// For persistence across restarts, subscriptions are ALSO saved to Firebase (see subscribe route)
let pushSubscriptions = [];

// Load subscriptions from Firebase on startup
(async () => {
  try {
    const snap = await firebaseAdminService.db.collection('admin_push_subscriptions').get();
    snap.forEach(doc => {
      pushSubscriptions.push(doc.data().subscription);
    });
    console.log(`[Push] ${pushSubscriptions.length} assinatura(s) carregada(s) do Firebase.`);
  } catch (e) {
    console.log('[Push] Nenhuma assinatura encontrada (normal na primeira vez).');
  }
})();

// Helper: Send push to all admin subscriptions
const sendPushToAdmin = async (title, body, tag = 'rifababy') => {
  const payload = JSON.stringify({ title, body, icon: '/banner.png', tag, url: '/admin' });
  const dead = [];
  await Promise.all(pushSubscriptions.map(async (sub, i) => {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        dead.push(i); // Subscription expired
      }
    }
  }));
  // Remove dead subscriptions
  dead.reverse().forEach(i => pushSubscriptions.splice(i, 1));
};

// ── Route: Save Push Subscription ─────────────────────────────────────────────
router.post('/push/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

    // Avoid duplicates
    const exists = pushSubscriptions.some(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      pushSubscriptions.push(subscription);
      // Persist to Firebase so it survives server restarts
      const id = Buffer.from(subscription.endpoint).toString('base64').slice(-20);
      await firebaseAdminService.db.collection('admin_push_subscriptions').doc(id).set({ subscription, updatedAt: new Date().toISOString() });
      console.log(`[Push] Nova assinatura salva. Total: ${pushSubscriptions.length}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Push] Erro ao salvar assinatura:', err.message);
    res.status(500).json({ error: 'Falha ao salvar assinatura' });
  }
});

// ── Route: Get VAPID Public Key ───────────────────────────────────────────────
router.get('/push/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC });
});

// ── Route: Manual Payment Status Check (polling fallback) ─────────────────────
// Called by frontend every 15s while Pix modal is open, and by admin "Verificar" button
router.get('/pix/check/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const paymentInfo = await mercadopagoService.getPaymentStatus(paymentId);
    if (!paymentInfo) return res.json({ status: 'unknown' });

    const status = paymentInfo.status; // 'pending', 'approved', 'rejected', etc.
    console.log(`[Check] Payment ${paymentId} status: ${status}`);

    if (status === 'approved') {
      const txid = String(paymentId);
      // Try to update Firebase (idempotent — safe to call multiple times)
      const updated = await firebaseAdminService.updateNumberStatusByTxid('baby_shower_01', txid, 'PAID');
      if (!updated && paymentInfo.external_reference) {
        try {
          const ref = JSON.parse(paymentInfo.external_reference);
          if (ref.raffleId && Array.isArray(ref.numbers)) {
            const batch = firebaseAdminService.db.batch();
            for (const num of ref.numbers) {
              const docRef = firebaseAdminService.db.collection('raffles').doc(ref.raffleId).collection('numbers').doc(String(num));
              batch.update(docRef, { status: 'PAID', paidAt: new Date().toISOString() });
            }
            await batch.commit();
            console.log(`[Check] Fallback PAID update for ${ref.numbers.length} numbers`);
          }
        } catch (e) { console.error('[Check] Fallback error:', e.message); }
      }
      // Also send push notification
      await sendPushToAdmin('💰 Pix Recebido!', 'Pagamento aprovado! Número confirmado.', 'pagamento-confirmado');
    }

    res.json({ status, approved: status === 'approved' });
  } catch (err) {
    console.error('[Check] Error:', err.message);
    res.json({ status: 'error' });
  }
});

// ── Route: Keep-alive ping ─────────────────────────────────────────────────────
router.get('/ping', (req, res) => res.json({ ok: true, ts: Date.now() }));

// ── PIX Routes (unchanged) ────────────────────────────────────────────────────
router.post('/pix/create', async (req, res) => {
  try {
    const { customerName, customerPhone, numbers, value, raffleId } = req.body;
    const txid = uuidv4().replace(/-/g, '').substring(0, 30);
    const cobData = await caktoService.createPixCharge(txid, value, customerName, customerPhone, `Rifa ${raffleId} - Números: ${numbers.join(', ')}`);
    const emvPayload = cobData.pix?.qr_code || cobData.pixCopiaECola || cobData.payload;
    const qrCodeImage = await QRCode.toDataURL(emvPayload, { errorCorrectionLevel: 'M', margin: 1 });
    for (const num of numbers) {
      await firebaseAdminService.updateNumberStatus(raffleId, num, 'PENDING_PAYMENT', txid);
    }
    res.json({ success: true, chargeId: txid, qrCode: qrCodeImage, payload: emvPayload });
  } catch (error) {
    console.error('Erro ao criar Pix BACEN:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao gerar Pix' });
  }
});

router.post('/webhooks/cakto', async (req, res) => {
  try {
    const payload = req.body;
    let transactionId = null;
    let isPaid = false;
    if (payload.status === 'PAID' || payload.type === 'order.paid' || payload.event === 'PAYMENT_RECEIVED') {
      isPaid = true;
      transactionId = payload.reference_id || payload.data?.reference_id;
    } else if (payload.pix && payload.pix.length > 0) {
      isPaid = true;
      transactionId = payload.pix[0].txid;
    }
    if (isPaid && transactionId) {
      await firebaseAdminService.updateNumberStatusByTxid('baby_shower_01', transactionId, 'PAID');
    }
    res.status(200).send({ received: true });
  } catch (error) {
    res.status(500).send('Webhook Error');
  }
});

router.post('/pix/create-mp', async (req, res) => {
  try {
    const { customerName, customerPhone, numbers, value, raffleId } = req.body;
    const pixData = await mercadopagoService.createPixPayment(value, customerName, customerPhone, raffleId, numbers);
    if (!pixData.success) return res.status(500).json({ success: false, error: 'Erro no Mercado Pago' });
    const qrCodeImage = await QRCode.toDataURL(pixData.qr_code, { errorCorrectionLevel: 'M', margin: 1 });
    const txid = String(pixData.id);
    for (const num of numbers) {
      await firebaseAdminService.updateNumberStatus(raffleId, num, 'PENDING_PAYMENT', txid, pixData.qr_code);
    }

    // 🔔 Notify admin: new Pix generated
    await sendPushToAdmin('🚨 Nova Reserva!', `${customerName} gerou um Pix para ${numbers.length} número(s).`, 'pix-gerado');

    res.json({ success: true, chargeId: txid, qrCode: qrCodeImage, payload: pixData.qr_code });
  } catch (error) {
    console.error('Erro /pix/create-mp:', error);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

router.post('/webhook/mercadopago', async (req, res) => {
  // Respond immediately so Mercado Pago doesn't retry
  res.status(200).send('OK');

  try {
    const body = req.body;
    const isPaymentEvent = body.type === 'payment' || (body.action && String(body.action).includes('payment'));
    if (!isPaymentEvent) return;

    const paymentId = body.data?.id;
    if (!paymentId) return;

    const paymentInfo = await mercadopagoService.getPaymentStatus(paymentId);
    console.log('[Webhook MP] Status:', paymentInfo?.status, '| Payer:', paymentInfo?.payer?.first_name);

    if (paymentInfo && paymentInfo.status === 'approved') {
      const txid = String(paymentId);

      // Strategy 1: by transactionId
      const updated = await firebaseAdminService.updateNumberStatusByTxid('baby_shower_01', txid, 'PAID');

      // Strategy 2: fallback via external_reference
      if (!updated && paymentInfo.external_reference) {
        try {
          const ref = JSON.parse(paymentInfo.external_reference);
          if (ref.raffleId && Array.isArray(ref.numbers)) {
            const batch = firebaseAdminService.db.batch();
            for (const num of ref.numbers) {
              const docRef = firebaseAdminService.db.collection('raffles').doc(ref.raffleId).collection('numbers').doc(String(num));
              batch.update(docRef, { status: 'PAID', paidAt: new Date().toISOString() });
            }
            await batch.commit();
            console.log(`[Webhook MP] ✅ Fallback: números marcados como PAID via external_reference`);
          }
        } catch (e) {
          console.error('[Webhook MP] Fallback parse error:', e.message);
        }
      }

      // 🔔 Notify admin: payment confirmed
      const name = paymentInfo.payer?.first_name || 'Cliente';
      const amount = (paymentInfo.transaction_amount || 0).toFixed(2).replace('.', ',');
      await sendPushToAdmin('💰 Pix Recebido!', `${name} pagou R$ ${amount}. Números confirmados!`, 'pagamento-confirmado');
    }
  } catch (error) {
    console.error('[Webhook MP] Erro:', error.message);
  }
});

module.exports = router;
