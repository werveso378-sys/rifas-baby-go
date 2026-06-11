import React, { useState, useEffect } from 'react';
import { listenToNumbers } from '../services/firebaseService';
import GlassCard from '../components/GlassCard';

const RAFFLE_ID = "baby_shower_01"; // ID MOCK

const Admin = () => {
  const [numbersData, setNumbersData] = useState([]);

  useEffect(() => {
    const unsubscribe = listenToNumbers(RAFFLE_ID, (data) => {
      setNumbersData(data);
    });
    return () => unsubscribe();
  }, []);

  const totalNumbers = numbersData.length;
  const paidNumbers = numbersData.filter(n => n.status === 'PAID').length;
  const pendingNumbers = numbersData.filter(n => n.status === 'PENDING_PAYMENT').length;
  const totalRevenue = paidNumbers * 5.00;

  return (
    <div className="w-full flex justify-center pb-20 animate-fade-in">
      <GlassCard className="w-full max-w-4xl">
        <h1 style={{ color: 'var(--primary)', marginBottom: '20px' }}>Painel Administrativo</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '30px' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3>Arrecadação</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>R$ {totalRevenue.toFixed(2).replace('.', ',')}</p>
          </div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3>Pagos</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2e7d32' }}>{paidNumbers} / {totalNumbers}</p>
          </div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3>Aguardando Pix</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#b58900' }}>{pendingNumbers}</p>
          </div>
        </div>

        <h2 style={{ marginBottom: '15px' }}>Últimas Reservas</h2>
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '12px' }}>Número</th>
                <th style={{ padding: '12px' }}>Nome</th>
                <th style={{ padding: '12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {numbersData.filter(n => n.status !== 'AVAILABLE').map(num => (
                <tr key={num.number} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{String(num.number).padStart(2, '0')}</td>
                  <td style={{ padding: '12px' }}>{num.ownerName || 'Desconhecido'}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '12px', 
                      fontSize: '0.85rem',
                      background: num.status === 'PAID' ? '#e8f5e9' : '#fdf6e3',
                      color: num.status === 'PAID' ? '#2e7d32' : '#b58900'
                    }}>
                      {num.status === 'PAID' ? 'Pago' : 'Pendente'}
                    </span>
                  </td>
                </tr>
              ))}
              {numbersData.filter(n => n.status !== 'AVAILABLE').length === 0 && (
                <tr>
                  <td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Nenhuma reserva ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};

export default Admin;
