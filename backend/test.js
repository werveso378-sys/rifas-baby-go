const axios = require('axios');

async function runTests() {
  try {
    console.log('--- TEST 1: POST /api/pix/create ---');
    const createRes = await axios.post('http://localhost:3000/api/pix/create', {
      customerName: "Test User",
      customerPhone: "11999999999",
      numbers: [5, 10],
      value: 10.00,
      raffleId: "baby_shower_01"
    });
    
    console.log('Status:', createRes.status);
    console.log('Response:', JSON.stringify(createRes.data, null, 2));

    const { chargeId, payload, qrCode } = createRes.data;

    if (!payload || !payload.startsWith('000201')) {
      console.error('ERRO: O payload não começa com 000201. Payload:', payload);
    } else {
      console.log('SUCESSO: Payload EMV validado (000201...).');
    }

    if (!qrCode || !qrCode.startsWith('data:image/png;base64')) {
      console.error('ERRO: QR Code inválido.');
    } else {
      console.log('SUCESSO: Imagem base64 do QR Code gerada.');
    }

    console.log('\n--- TEST 2: POST /api/webhooks/pix ---');
    const webhookRes = await axios.post('http://localhost:3000/api/webhooks/pix', {
      pix: [
        {
          endToEndId: "E00000000202010141209abc123def45",
          txid: chargeId, // Passando o txid retornado da primeira API
          valor: "10.00",
          chave: "facilmente79@gmail.com",
          horario: new Date().toISOString()
        }
      ]
    });

    console.log('Status:', webhookRes.status);
    console.log('Response:', webhookRes.data);
    console.log('SUCESSO: Webhook aceito pelo backend.');

  } catch (error) {
    console.error('ERRO NOS TESTES:', error.response?.data || error.message);
  }
}

runTests();
