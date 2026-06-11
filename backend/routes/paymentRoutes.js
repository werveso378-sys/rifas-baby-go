const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const caktoService = require('../services/caktoService');
const firebaseAdminService = require('../services/firebaseAdminService');
const mercadopagoService = require('../services/mercadopagoService');

// Rota para o frontend solicitar a geração de Pix
router.post('/pix/create', async (req, res) => {
  try {
    const { customerName, customerPhone, numbers, value, raffleId } = req.body;

    // 1. Gerar um txid único segundo a especificação BACEN (26-35 caracteres alfanuméricos)
    const txid = uuidv4().replace(/-/g, '').substring(0, 30);

    // 2. Criar cobrança na API da Cakto
    const cobData = await caktoService.createPixCharge(
      txid,
      value,
      customerName,
      customerPhone,
      `Rifa ${raffleId} - Números: ${numbers.join(', ')}`
    );

    // 3. Extrair a string EMV (Pix Copia e Cola). O caminho exato depende da documentação final da Cakto.
    // Usamos ?. para evitar crash se o formato mudar.
    const emvPayload = cobData.pix?.qr_code || cobData.pixCopiaECola || cobData.payload;

    // 4. Gerar o QR Code visual (Data URI base64) a partir do payload
    const qrCodeImage = await QRCode.toDataURL(emvPayload, {
      errorCorrectionLevel: 'M',
      margin: 1
    });

    // 5. Atualizar status dos números no Firebase para "Aguardando Pagamento"
    for (const num of numbers) {
      // Usamos o txid como referência de transação para validar o webhook depois
      await firebaseAdminService.updateNumberStatus(raffleId, num, 'PENDING_PAYMENT', txid);
    }

    res.json({
      success: true,
      chargeId: txid,
      qrCode: qrCodeImage,
      payload: emvPayload
    });

  } catch (error) {
    console.error('Erro ao criar Pix BACEN:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao gerar Pix' });
  }
});

/**
 * Webhook da Cakto
 * Recebe notificações de pagamento
 */
router.post('/webhooks/cakto', async (req, res) => {
  try {
    const payload = req.body;
    console.log(`[Webhook Cakto] Payload recebido:`, JSON.stringify(payload));

    // A lógica exata de extração do TXID depende do evento da Cakto (ex: "charge.paid" ou "order.paid")
    // Assumindo que a Cakto envia o reference_id que nós enviamos na criação
    let transactionId = null;
    let isPaid = false;

    // Tentativa genérica de ler o payload (Ajustar baseado na doc da Cakto)
    if (payload.status === 'PAID' || payload.type === 'order.paid' || payload.event === 'PAYMENT_RECEIVED') {
      isPaid = true;
      transactionId = payload.reference_id || payload.data?.reference_id || payload.order?.reference_id;
    } else if (payload.pix && payload.pix.length > 0) {
       // Fallback caso a Cakto use o formato parecido com o Bacen
       isPaid = true;
       transactionId = payload.pix[0].txid;
    }

    if (isPaid && transactionId) {
      console.log(`[Webhook Cakto] Pagamento confirmado para a Transação: ${transactionId}`);
      await firebaseAdminService.updateNumberStatusByTxid('baby_shower_01', transactionId, 'PAID');
    } else {
      console.log(`[Webhook Cakto] Evento ignorado ou TXID não encontrado.`);
    }

    res.status(200).send({ received: true });
  } catch (error) {
    console.error('Erro no Webhook da Cakto:', error);
    res.status(500).send('Webhook Error');
  }
});

// ----------------------------------------------------------------------
// INTEGRAÇÃO MERCADO PAGO
// ----------------------------------------------------------------------

router.post('/pix/create-mp', async (req, res) => {
  try {
    const { customerName, customerPhone, numbers, value, raffleId } = req.body;
    
    const pixData = await mercadopagoService.createPixPayment(value, customerName, customerPhone, raffleId, numbers);
    
    if (!pixData.success) {
      return res.status(500).json({ success: false, error: 'Erro no Mercado Pago' });
    }

    const qrCodeImage = await QRCode.toDataURL(pixData.qr_code, { errorCorrectionLevel: 'M', margin: 1 });

    const txid = String(pixData.id);
    for (const num of numbers) {
      await firebaseAdminService.updateNumberStatus(raffleId, num, 'PENDING_PAYMENT', txid);
    }

    res.json({
      success: true,
      chargeId: txid,
      qrCode: qrCodeImage,
      payload: pixData.qr_code
    });
  } catch (error) {
    console.error('Erro /pix/create-mp:', error);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

router.post('/webhook/mercadopago', async (req, res) => {
  try {
    const { action, type, data } = req.body;
    
    // Mercado Pago envia type="payment" ou action="payment.updated" dependendo da versão
    if (type === 'payment' || (action && action.includes('payment'))) {
      const paymentId = data?.id;
      if (paymentId) {
        const paymentInfo = await mercadopagoService.getPaymentStatus(paymentId);
        
        if (paymentInfo && paymentInfo.status === 'approved') {
          const txid = String(paymentId);
          console.log(`[Webhook MP] Pagamento aprovado: ${txid}`);
          // Atualizamos todos os números vinculados a esse ID para PAGO
          await firebaseAdminService.updateNumberStatusByTxid('baby_shower_01', txid, 'PAID');
        }
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Erro Webhook MP:', error);
    res.status(500).send('Error');
  }
});

module.exports = router;
