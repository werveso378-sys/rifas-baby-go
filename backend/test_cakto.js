require('dotenv').config();
const caktoService = require('./services/caktoService');

async function runTest() {
  console.log("=== INICIANDO TESTE CAKTO API ===");
  try {
    // Parâmetros simulados
    const transactionId = "TESTE_" + Math.floor(Math.random() * 100000);
    const value = 1.00; // R$ 1,00
    const customerName = "Testador";
    const customerPhone = "11999999999";
    const description = "Rifa Teste";

    console.log("Chamando createPixCharge...");
    const result = await caktoService.createPixCharge(transactionId, value, customerName, customerPhone, description);
    
    console.log("\n=== SUCESSO! RESPOSTA DA CAKTO ===");
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("\n=== ERRO NO TESTE ===");
    console.error(error.message);
  }
}

runTest();
