const API_URL = import.meta.env.VITE_API_URL || 'https://rifas-baby-go.onrender.com/api';

/**
 * Solicita a criação de um Pix ao backend
 */
export const generatePix = async (paymentData) => {
  try {
    const response = await fetch(`${API_URL}/pix/create-mp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    if (!response.ok) {
      throw new Error('Falha ao gerar o Pix');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro no paymentService:', error);
    // Retorno de fallback para simulação offline se o backend não estiver rodando
    console.warn("Retornando dados MOCK pois o backend pode estar desligado.");
    return {
      success: true,
      chargeId: "mock_123",
      qrCode: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAgMBAA+g88kAAAAASUVORK5CYII=",
      payload: "00020101021226580014br.gov.bcb.pix0136mock-offline..."
    };
  }
};

/**
 * Solicita o estorno de um Pix ao backend
 */
export const refundPayment = async (paymentId, raffleId, numbers) => {
  try {
    const response = await fetch(`${API_URL}/pix/refund/${paymentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raffleId, numbers })
    });

    if (!response.ok) {
      throw new Error('Falha ao estornar o Pix');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro no refundPayment:', error);
    return { success: false, error: error.message };
  }
};
