require('dotenv').config();
const axios = require('axios');

const CAKTO_BASE_URL = 'https://api.cakto.com.br';
const CAKTO_CLIENT_ID = process.env.CAKTO_CLIENT_ID || 'FtjbukkBPGR7vS34HkBUa9krSBMJ0uvxtlh90OkR';
const CAKTO_CLIENT_SECRET = process.env.CAKTO_CLIENT_SECRET || 'ndL2BwKdNV0jF3cz27uSWocpyiMMAwKOppDw4AUawPTcTKdsXfCWX8Xm5XYINcLKZuVtiBUhQZrCjJSj9HoboddnE3aK5pGmGz4nlbmdJDjPR6X8WUrU1irHOvH262PU';

async function testPaths() {
  try {
    const authString = Buffer.from(`${CAKTO_CLIENT_ID}:${CAKTO_CLIENT_SECRET}`).toString('base64');
    const bodyData = `client_id=${CAKTO_CLIENT_ID}&client_secret=${CAKTO_CLIENT_SECRET}`;
    
    console.log("Autenticando...");
    const authRes = await axios.post(`${CAKTO_BASE_URL}/public_api/token/`, bodyData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const token = authRes.data.access_token;
    console.log("Token obtido com sucesso!");

    const paths = [
      '/public_api/orders',
      '/public_api/transactions',
      '/public_api/payments',
      '/public_api/checkout',
      '/public_api/pix'
    ];

    const payload = {
      reference_id: "TEST_123",
      payment_method: "PIX",
      items: [{ name: "Rifa 0.01", quantity: 1, unit_amount: 1 }],
      customer: { name: "Testador", phone: "11999999999" }
    };

    for (const path of paths) {
      console.log(`\nTestando POST ${path}...`);
      try {
        const res = await axios.post(`${CAKTO_BASE_URL}${path}`, payload, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`SUCESSO! Path correto: ${path}`);
        console.log(res.data);
        return; // Encontramos
      } catch (err) {
        console.log(`Falha: ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
      }
    }
    console.log("\nNenhum dos caminhos testados funcionou para gerar pedido diretamente.");
  } catch (err) {
    console.error("Erro fatal:", err.message);
  }
}

testPaths();
