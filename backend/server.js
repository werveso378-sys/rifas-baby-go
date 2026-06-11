require('dotenv').config();
const express = require('express');
const cors = require('cors');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rotas de API
app.use('/api', paymentRoutes);

// Rota raiz para verificação
app.get('/', (req, res) => {
  res.send('Backend RifaBaby API is running.');
});

const { db } = require('./services/firebaseAdminService');

// Faxineiro Automático (Roda a cada 60s para liberar números expirados)
setInterval(async () => {
  if (!db) return; // Aguarda inicialização do Firebase
  try {
    const now = new Date().toISOString();
    const snapshot = await db.collectionGroup('numbers')
      .where('status', 'in', ['RESERVED', 'PENDING_PAYMENT'])
      .where('expiresAt', '<', now)
      .get();
      
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.update(doc.ref, {
          status: 'AVAILABLE',
          ownerName: null,
          ownerWhatsApp: null,
          reservedAt: null,
          expiresAt: null,
          transactionId: null
        });
      });
      await batch.commit();
      console.log(`[Sweeper] Liberou ${snapshot.size} número(s) expirado(s).`);
    }
  } catch(error) {
    console.error('[Sweeper] Erro ao liberar números:', error);
  }
}, 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // ── Keep-alive: ping self every 10 minutes to prevent Render free-tier sleep ──
  // Render sleeps after ~15min of inactivity, causing webhook cold-start failures
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(async () => {
    try {
      const res = await fetch(`${SELF_URL}/api/ping`);
      const data = await res.json();
      console.log(`[Keep-alive] Ping OK — ${new Date(data.ts).toISOString()}`);
    } catch (e) {
      console.warn(`[Keep-alive] Ping falhou: ${e.message}`);
    }
  }, 10 * 60 * 1000); // every 10 minutes
});
