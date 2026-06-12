const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');

let db;

try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require(path.join(__dirname, '../config/serviceAccountKey.json'));
  }

  initializeApp({
    credential: cert(serviceAccount)
  });
  
  db = getFirestore();
  console.log('Firebase Admin inicializado com sucesso (Conectado à nuvem).');
} catch (error) {
  console.error('Erro crítico ao inicializar Firebase Admin:', error);
}

/**
 * Atualiza o status de um número na Rifa (Usado quando gerar o Pix e quando pagar)
 */
async function updateNumberStatus(raffleId, number, status, transactionId, pixPayload = null) {
  try {
    const docRef = db.collection('raffles').doc(raffleId).collection('numbers').doc(String(number));
    
    const updateData = {
      status: status,
      transactionId: transactionId,
      updatedAt: FieldValue.serverTimestamp()
    };
    if (pixPayload) updateData.pixPayload = pixPayload;

    // Atualiza o documento (se ele já tiver sido reservado pelo Frontend, os dados do usuário já estarão lá)
    await docRef.set(updateData, { merge: true });

    console.log(`Sucesso: Número ${number} atualizado para status ${status}`);
    return true;
  } catch (error) {
    console.error(`Erro ao atualizar número ${number}:`, error);
    return false;
  }
}

/**
 * Atualiza múltiplos números de uma vez com base no TXID do Pix
 * (Usado pelo Webhook do BACEN quando o pagamento é confirmado)
 */
async function updateNumberStatusByTxid(raffleId, txid, newStatus) {
  try {
    const numbersRef = db.collection('raffles').doc(raffleId).collection('numbers');
    // Busca todos os números que têm esse txid aguardando pagamento
    const snapshot = await numbersRef.where('transactionId', '==', txid).get();

    if (snapshot.empty) {
      console.log(`Nenhum número encontrado para o TXID ${txid}`);
      return false;
    }

    // Atualiza todos em um único lote (Batch)
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { 
        status: newStatus,
        paidAt: FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
    console.log(`Pagamento confirmado! ${snapshot.size} número(s) atualizado(s) para PAID pelo TXID ${txid}`);
    return true;

  } catch (error) {
    console.error('Erro ao processar Webhook no Firestore:', error);
    return false;
  }
}

async function sendPushNotification(title, body, sound = 'default') {
  try {
    const settingsDoc = await db.collection('settings').doc('global').get();
    if (!settingsDoc.exists) return;
    
    const token = settingsDoc.data().fcmToken;
    if (!token) return;

    const message = {
      notification: {
        title,
        body,
      },
      android: {
        notification: {
          sound: sound, // e.g. 'kaching'
          channelId: 'rifas_vendas',
          icon: 'ic_stat_name', // transparent silhouette icon
          color: '#00E676'
        }
      },
      token: token
    };

    await getMessaging().send(message);
    console.log(`Push notification enviada: ${title}`);
  } catch (error) {
    console.error('Erro ao enviar push notification:', error);
  }
}

module.exports = {
  db,
  updateNumberStatus,
  updateNumberStatusByTxid,
  sendPushNotification
};
