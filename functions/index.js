const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { MercadoPagoConfig, Payment } = require('mercadopago');

// Inicializa o Firebase Admin na nuvem (usando credenciais padrão do ambiente do Functions)
admin.initializeApp();
const db = admin.firestore();

// O Token MP precisa vir da configuração de ambiente do Firebase ou process.env.
// Como fallback emergencial mantemos o que estava no servidor original.
// Recomenda-se setar no firebase usando: firebase functions:config:set mercadopago.token="SEU_TOKEN"
const mpToken = process.env.MP_ACCESS_TOKEN || 'APP_USR-6992101378676109-061112-64aff7c38952c08df0e4e2c4daa8c24d-3171516763';

const client = new MercadoPagoConfig({ accessToken: mpToken });
const paymentClient = new Payment(client);

// Helper para enviar push
async function sendPushToAdmin(title, body, sound = 'default') {
  try {
    const settingsDoc = await db.collection('settings').doc('global').get();
    if (settingsDoc.exists) {
      const token = settingsDoc.data().fcmToken;
      if (token) {
        const message = {
          notification: { title, body },
          android: {
            notification: {
              sound: sound,
              channelId: 'rifas_vendas',
              icon: 'ic_stat_name',
              color: '#00E676'
            }
          },
          token: token
        };
        await admin.messaging().send(message);
        console.log(`[Webhook MP] Push Nativo FCM enviado: ${title}`);
      }
    }

    // Web Push (fallback para painel web) - Lendo do Firestore
    const webPushSnap = await db.collection('admin_push_subscriptions').get();
    const pushSubscriptions = [];
    webPushSnap.forEach(doc => {
      pushSubscriptions.push(doc.data().subscription);
    });

    if (pushSubscriptions.length > 0) {
      // Como não queremos incluir a dependência web-push pesada no Functions se não precisar,
      // O push web seria disparado melhor pelo painel backend. Mas se quiser, pode chamar
      // webpush.sendNotification aqui. Para manter o Firebase enxuto, focamos no FCM.
      // E enviamos um documento na collection 'notifications_queue' para o Frontend ler em tempo real.
      await db.collection('notifications_queue').add({
        title,
        body,
        sound,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false
      });
      console.log(`[Webhook MP] Notificação adicionada à fila Web (para painel escutar).`);
    }

  } catch (error) {
    console.error('[Webhook MP] Erro ao enviar push notification:', error);
  }
}

// Helper para atualizar status no Firestore
async function updateNumberStatusByTxid(raffleId, txid, newStatus) {
  try {
    const numbersRef = db.collection('raffles').doc(raffleId).collection('numbers');
    const snapshot = await numbersRef.where('transactionId', '==', txid).get();

    if (snapshot.empty) {
      console.log(`[Webhook MP] Nenhum número encontrado para o TXID ${txid}`);
      return false;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { 
        status: newStatus,
        paidAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
    console.log(`[Webhook MP] Pagamento confirmado! ${snapshot.size} número(s) atualizado(s) para PAID pelo TXID ${txid}`);
    return true;
  } catch (error) {
    console.error('[Webhook MP] Erro ao atualizar no Firestore:', error);
    return false;
  }
}

exports.mpWebhook = functions.https.onRequest(async (req, res) => {
  // Retorna OK imediatamente para o MP não ficar tentando novamente
  res.status(200).send('OK');

  try {
    const body = req.body;
    const isPaymentEvent = body.type === 'payment' || (body.action && String(body.action).includes('payment'));
    if (!isPaymentEvent) return;

    const paymentId = body.data?.id;
    if (!paymentId) return;

    // Busca status no MP
    const paymentInfo = await paymentClient.get({ id: paymentId });
    console.log('[Webhook MP] Status:', paymentInfo?.status, '| Payer:', paymentInfo?.payer?.first_name);

    if (paymentInfo && paymentInfo.status === 'approved') {
      let raffleId = 'baby_shower_01';
      let ref = null;
      
      if (paymentInfo.external_reference) {
        try {
          ref = JSON.parse(paymentInfo.external_reference);
          if (ref.raffleId) raffleId = ref.raffleId;
        } catch (e) {
          console.error('[Webhook MP] Fallback parse error:', e.message);
        }
      }

      const txid = String(paymentId);
      const updated = await updateNumberStatusByTxid(raffleId, txid, 'PAID');

      if (!updated && ref && Array.isArray(ref.numbers)) {
        try {
          const batch = db.batch();
          for (const num of ref.numbers) {
            const docRef = db.collection('raffles').doc(raffleId).collection('numbers').doc(String(num));
            batch.update(docRef, { 
              status: 'PAID', 
              paidAt: admin.firestore.FieldValue.serverTimestamp() 
            });
          }
          await batch.commit();
          console.log(`[Webhook MP] ✅ Fallback: números marcados como PAID via external_reference`);
        } catch (e) {
          console.error('[Webhook MP] Fallback write error:', e.message);
        }
      }

      // Notifica o admin
      const name = paymentInfo.payer?.first_name || 'Cliente';
      const amount = (paymentInfo.transaction_amount || 0).toFixed(2).replace('.', ',');
      await sendPushToAdmin('💰 Pix Recebido!', `${name} pagou R$ ${amount}. Números confirmados!`, 'kaching');
    }
  } catch (error) {
    console.error('[Webhook MP] Erro interno:', error.message);
  }
});
