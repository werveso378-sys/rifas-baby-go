import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenToNumbers, cancelReservation, updateReservation } from '../services/firebaseService';
import { MessageCircle, Bell, Eye, EyeOff, ArrowLeft, Trash2, Edit2, X, Check } from 'lucide-react';
import GlassCard from '../components/GlassCard';

const RAFFLE_ID = "baby_shower_01";
const PRECO = 0.01;

const Admin = () => {
  const navigate = useNavigate();
  const [numbersData, setNumbersData] = useState([]);
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  
  const [toast, setToast] = useState(null);
  const [prevCount, setPrevCount] = useState(0);

  // Edit Modal State
  const [editingClient, setEditingClient] = useState(null);
  const [editName, setEditName] = useState('');
  const [editWhatsApp, setEditWhatsApp] = useState('');

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
      const latest = numbersData.filter(n => n.status !== 'AVAILABLE').pop();
      setToast(`🚨 Nova reserva feita por ${latest?.ownerName || 'alguém'}!`);
      setTimeout(() => setToast(null), 5000);
    }
    if (numbersData.length > 0) setPrevCount(resCount);
  }, [numbersData, prevCount]);

  if (!auth) {
    return (
      <div className="w-full flex justify-center pb-20 animate-fade-in" style={{ marginTop: '50px', padding: '20px' }}>
        <GlassCard className="w-full max-w-sm" style={{ textAlign: 'center', position: 'relative' }}>
          <button 
            onClick={() => navigate('/')} 
            style={{ position: 'absolute', top: '20px', left: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <ArrowLeft size={24} />
          </button>
          <h2 style={{ color: 'var(--primary-dark)', marginBottom: '10px', marginTop: '20px', fontSize: '1.4rem' }}>Acesso Restrito</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Área do Organizador</p>
          
          <div style={{ position: 'relative', marginTop: '24px', marginBottom: '24px' }}>
            <input 
              type={showPass ? "text" : "password"} 
              className="input-field" 
              style={{ paddingRight: '40px', fontSize: '0.95rem' }}
              value={pass} 
              onChange={e => setPass(e.target.value)} 
              placeholder="Digite a senha"
            />
            <button 
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
            >
              {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

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

  // Agrupamento de Compras
  const reservations = numbersData.filter(n => n.status !== 'AVAILABLE');
  const grouped = {};
  
  reservations.forEach(r => {
    const key = r.ownerWhatsApp || r.ownerName || Math.random().toString();
    if (!grouped[key]) {
      grouped[key] = {
        name: r.ownerName,
        whatsapp: r.ownerWhatsApp,
        numbers: [],
        status: 'PAID'
      };
    }
    grouped[key].numbers.push(r.number);
    if (r.status === 'PENDING_PAYMENT' || r.status === 'RESERVED') {
      grouped[key].status = 'PENDING_PAYMENT';
    }
  });

  const clients = Object.values(grouped).sort((a,b) => b.numbers.length - a.numbers.length);

  // Actions
  const sendWhatsAppReminder = (client) => {
    const text = `Olá ${client.name.split(' ')[0]}! Tudo bem? Vi que você reservou os números (${client.numbers.join(', ')}) no nosso Chá de Bebê. O pagamento de R$ ${(client.numbers.length * PRECO).toFixed(2).replace('.', ',')} está pendente. O link do Pix expirará em breve!`;
    const url = `https://wa.me/55${client.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCancelClient = async (client) => {
    if (window.confirm(`ATENÇÃO: Cancelar a reserva de ${client.name.split(' ')[0]} e devolver os números ${client.numbers.join(', ')} para venda?`)) {
      await cancelReservation(RAFFLE_ID, client.numbers);
    }
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setEditName(client.name || '');
    setEditWhatsApp(client.whatsapp || '');
  };

  const saveEditClient = async () => {
    if(!editName || !editWhatsApp) {
      alert("Preencha nome e número.");
      return;
    }
    await updateReservation(RAFFLE_ID, editingClient.numbers, editName, editWhatsApp);
    setEditingClient(null);
  };

  return (
    <div className="w-full flex justify-center pb-20 animate-fade-in" style={{ padding: '0 12px' }}>
      {toast && (
        <div className="animate-slide-up" style={toastStyle}>
          <Bell size={16} /> {toast}
        </div>
      )}

      {/* Edit Modal Override */}
      {editingClient && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle} className="animate-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--primary-dark)', fontSize: '1.2rem' }}>Editar Cliente</h3>
              <button onClick={() => setEditingClient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <X size={24} />
              </button>
            </div>
            
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Nome Completo</label>
            <input 
              className="input-field" 
              value={editName} 
              onChange={e => setEditName(e.target.value)} 
              style={{ marginBottom: '16px' }}
            />
            
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>WhatsApp</label>
            <input 
              className="input-field" 
              value={editWhatsApp} 
              type="tel"
              onChange={e => setEditWhatsApp(e.target.value)} 
              style={{ marginBottom: '24px' }}
            />

            <button className="btn btn-primary" onClick={saveEditClient}>
              Salvar Alterações <Check size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <button 
            onClick={() => navigate('/')} 
            style={{ background: 'white', border: '1px solid #eee', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--primary-dark)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ color: 'var(--primary-dark)', margin: 0, fontSize: '1.4rem' }}>Painel do Organizador</h1>
        </div>
        
        {/* Dashboard Arrecadação */}
        <h2 style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Dashboard</h2>
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', scrollbarWidth: 'none' }}>
          <div style={dashCardStyle}>
            <div style={dashTitleStyle}>Arrecadado</div>
            <div style={{...dashValueStyle, color: 'var(--primary-dark)'}}>R$ {totalRevenue.toFixed(2).replace('.', ',')}</div>
          </div>
          <div style={dashCardStyle}>
            <div style={dashTitleStyle}>Números Pagos</div>
            <div style={{...dashValueStyle, color: '#34C759'}}>{paidNumbers}/{totalNumbers}</div>
          </div>
          <div style={dashCardStyle}>
            <div style={dashTitleStyle}>Aguardando Pix</div>
            <div style={{...dashValueStyle, color: '#FF9500'}}>{pendingNumbers}</div>
          </div>
          <div style={dashCardStyle}>
            <div style={dashTitleStyle}>Livres</div>
            <div style={{...dashValueStyle, color: '#007AFF'}}>{totalNumbers - paidNumbers - pendingNumbers}</div>
          </div>
        </div>

        {/* Lista de Pessoas */}
        <div style={{ marginTop: '24px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--text-muted)', margin: 0 }}>Dados de Pessoas ({clients.length})</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {clients.map((client, idx) => (
            <div key={idx} style={{ background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.02)' }}>
              
              {/* Header do Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: 'var(--primary-dark)' }}>{client.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{client.whatsapp}</p>
                </div>
                <span style={{ 
                  padding: '4px 10px', 
                  borderRadius: '20px', 
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  background: client.status === 'PAID' ? '#EAF8F1' : '#FFF5E5',
                  color: client.status === 'PAID' ? '#34C759' : '#FF9500'
                }}>
                  {client.status === 'PAID' ? 'PAGO' : 'PENDENTE'}
                </span>
              </div>

              {/* Informações da Compra */}
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: '10px 12px', borderRadius: '10px', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                  {client.numbers.length} número(s) • R$ {(client.numbers.length * PRECO).toFixed(2).replace('.', ',')}
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: '600', wordWrap: 'break-word' }}>
                  {client.numbers.sort((a,b)=>a-b).join(', ')}
                </p>
              </div>

              {/* Ações (Botões) */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                {client.status === 'PENDING_PAYMENT' && (
                  <button onClick={() => sendWhatsAppReminder(client)} style={{...actionBtnStyle, background: '#EAF8F1', color: '#34C759'}}>
                    <MessageCircle size={14} /> Lembrar
                  </button>
                )}
                <button onClick={() => openEditModal(client)} style={{...actionBtnStyle, background: '#F0F4FF', color: '#007AFF'}}>
                  <Edit2 size={14} /> Editar
                </button>
                <button onClick={() => handleCancelClient(client)} style={{...actionBtnStyle, background: '#FFF0F2', color: '#FF3B30'}}>
                  <Trash2 size={14} /> Cancelar Compra
                </button>
              </div>

            </div>
          ))}

          {clients.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'white', borderRadius: '16px' }}>
              Nenhuma reserva registrada ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Styles Extras para o Celular
const dashCardStyle = {
  background: 'white',
  padding: '16px',
  borderRadius: '16px',
  boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
  minWidth: '130px',
  flexShrink: 0,
  border: '1px solid rgba(0,0,0,0.02)'
};

const dashTitleStyle = {
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
  marginBottom: '6px',
  fontWeight: '600'
};

const dashValueStyle = {
  fontSize: '1.4rem',
  fontWeight: 'bold'
};

const actionBtnStyle = {
  border: 'none',
  padding: '8px 14px',
  borderRadius: '20px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  backdropFilter: 'blur(4px)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px'
};

const modalContentStyle = {
  background: 'white',
  width: '100%',
  maxWidth: '400px',
  padding: '24px',
  borderRadius: '24px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
};

const toastStyle = {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#1D1D1F',
  color: 'white',
  padding: '10px 20px',
  borderRadius: '30px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  zIndex: 9999,
  fontWeight: '600',
  fontSize: '0.85rem'
};

export default Admin;
