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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
