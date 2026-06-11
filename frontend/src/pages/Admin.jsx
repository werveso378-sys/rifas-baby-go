import React, { useState, useEffect } from 'react';
import { listenToNumbers } from '../services/firebaseService';
import { MessageCircle, Bell } from 'lucide-react';
import GlassCard from '../components/GlassCard';

const RAFFLE_ID = "baby_shower_01";
const PRECO = 0.01;

const Admin = () => {
  const [numbersData, setNumbersData] = useState([]);
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState('');
  
  const [toast, setToast] = useState(null);
  const [prevCount, setPrevCount] = useState(0);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = listenToNumbers(RAFFLE_ID, (data) => {
      setNumbersData(data);
    });
    return () => unsubscribe();
  }, [auth]);

  // Real-time Notification System
  useEffect(() => {
    const resCount = numbersData.filter(n => n.status !== 'AVAILABLE').length;
    if (resCount > prevCount && prevCount !== 0) {
      // Found new reservation
      const latest = numbersData.filter(n => n.status !== 'AVAILABLE').pop();
      setToast(`🚨 Nova reserva feita por ${latest?.ownerName || 'alguém'}!`);
      setTimeout(() => setToast(null), 5000);
    }
    if (numbersData.length > 0) setPrevCount(resCount);
  }, [numbersData, prevCount]);

  if (!auth) {
    return (
      <div className="w-full flex justify-center pb-20 animate-fade-in" style={{ marginTop: '50px', padding: '20px' }}>
        <GlassCard className="w-full max-w-sm" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--primary-dark)', marginBottom: '10px' }}>Acesso Restrito</h2>
          <p style={{ color: 'var(--text-muted)' }}>Área do Organizador</p>
          <input 
            type="password" 
            className="input-field" 
            style={{ marginTop: '24px', marginBottom: '24px' }}
            value={pass} 
            onChange={e => setPass(e.target.value)} 
            placeholder="Digite a senha"
          />
          <button className="btn btn-primary" onClick={() => pass === '253658Eb011125@' ? setAuth(true) : alert('Senha incorreta!')}>
            Entrar no Painel
          </button>
        </GlassCard>
      </div>
    );
  }

  // Estatísticas
  const totalNumbers = 100;
  const paidNumbers = numbersData.filter(n => n.status === 'PAID').length;
  const pendingNumbers = numbersData.filter(n => n.status === 'PENDING_PAYMENT' || n.status === 'RESERVED').length;
  const totalRevenue = paidNumbers * PRECO;

  // Agrupamento de Compras por Cliente
  const reservations = numbersData.filter(n => n.status !== 'AVAILABLE');
  const grouped = {};
  
  reservations.forEach(r => {
    const key = r.ownerWhatsApp || r.ownerName || Math.random().toString();
    if (!grouped[key]) {
      grouped[key] = {
        name: r.ownerName,
        whatsapp: r.ownerWhatsApp,
        numbers: [],
        status: 'PAID' // Assume pago, mas se algum for pendente, vira pendente
      };
    }
    grouped[key].numbers.push(r.number);
    if (r.status === 'PENDING_PAYMENT' || r.status === 'RESERVED') {
      grouped[key].status = 'PENDING_PAYMENT';
    }
  });

  const clients = Object.values(grouped).sort((a,b) => b.numbers.length - a.numbers.length); // Ordena por quem comprou mais

  const sendWhatsAppReminder = (client) => {
    const text = `Olá ${client.name.split(' ')[0]}! Tudo bem? Vi que você reservou os números (${client.numbers.join(', ')}) no nosso Chá de Bebê. O pagamento de R$ ${(client.numbers.length * PRECO).toFixed(2).replace('.', ',')} está pendente. O link do Pix expirará em breve!`;
    const url = `https://wa.me/55${client.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="w-full flex justify-center pb-20 animate-fade-in" style={{ padding: '0 16px' }}>
      {toast && (
        <div className="animate-slide-up" style={toastStyle}>
          <Bell size={18} /> {toast}
        </div>
      )}

      <div className="w-full max-w-4xl">
        <h1 style={{ color: 'var(--primary-dark)', marginBottom: '24px' }}>Painel do Organizador</h1>
        
        {/* Cards de Resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <GlassCard style={{ padding: '20px' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>Arrecadação Livre</h3>
            <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary-dark)' }}>R$ {totalRevenue.toFixed(2).replace('.', ',')}</p>
          </GlassCard>
          <GlassCard style={{ padding: '20px' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>Números Pagos</h3>
            <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#34C759' }}>{paidNumbers} / {totalNumbers}</p>
          </GlassCard>
          <GlassCard style={{ padding: '20px' }}>
            <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>Aguardando Pix</h3>
            <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#FF9500' }}>{pendingNumbers}</p>
          </GlassCard>
        </div>

        <h2 style={{ marginBottom: '16px', color: 'var(--primary-dark)' }}>Clientes Registrados</h2>
        <GlassCard style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Cliente</th>
                  <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Números (Qtd)</th>
                  <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Status</th>
                  <th style={{ padding: '16px', color: 'var(--text-muted)' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.whatsapp} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: '600', color: 'var(--primary-dark)' }}>{client.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{client.whatsapp}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--accent-blue)' }}>{client.numbers.length} números</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {client.numbers.sort((a,b)=>a-b).join(', ')}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ 
                        padding: '6px 12px', 
                        borderRadius: '20px', 
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: client.status === 'PAID' ? '#EAF8F1' : '#FFF5E5',
                        color: client.status === 'PAID' ? '#34C759' : '#FF9500'
                      }}>
                        {client.status === 'PAID' ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      {client.status === 'PENDING_PAYMENT' && client.whatsapp && (
                        <button 
                          onClick={() => sendWhatsAppReminder(client)}
                          style={{ background: '#25D366', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                        >
                          <MessageCircle size={16} /> Lembrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhum cliente registrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

const toastStyle = {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#1D1D1F',
  color: 'white',
  padding: '12px 24px',
  borderRadius: '30px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  zIndex: 9999,
  fontWeight: '600'
};

export default Admin;
