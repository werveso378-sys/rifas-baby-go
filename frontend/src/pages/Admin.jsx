import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenToNumbers, cancelReservation, updateReservation } from '../services/firebaseService';
import { MessageCircle, Bell, Eye, EyeOff, ArrowLeft, Trash2, Edit2, X, Check } from 'lucide-react';

const RAFFLE_ID = "baby_shower_01";
const PRECO = 0.01;

const Admin = () => {
  const navigate = useNavigate();
  const [numbersData, setNumbersData] = useState([]);
  const [auth, setAuth] = useState(() => localStorage.getItem('isAdminLoggedIn') === 'true');
  const [pass, setPass] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Notification states
  const [toast, setToast] = useState(null);
  const [prevPending, setPrevPending] = useState(0);
  const [prevPaid, setPrevPaid] = useState(0);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Modal states
  const [cancelClient, setCancelClient] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [editName, setEditName] = useState('');
  const [editWhatsApp, setEditWhatsApp] = useState('');

  // Firebase listener — only when logged in
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = listenToNumbers(RAFFLE_ID, (data) => {
      setNumbersData(data);
    });
    return () => unsubscribe();
  }, [auth]);

  // Real-time Notification System
  useEffect(() => {
    if (!auth) return;
    const pendingCount = numbersData.filter(n => n.status === 'PENDING_PAYMENT').length;
    const paidCount = numbersData.filter(n => n.status === 'PAID').length;

    if (!isFirstLoad) {
      if (pendingCount > prevPending) {
        setToast('🚨 Nova reserva (Pix gerado)!');
        setTimeout(() => setToast(null), 5000);
        new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg').play().catch(() => {});
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Nova Reserva!', { body: 'Um cliente gerou um Pix.', icon: '/banner.png' });
        }
      }
      if (paidCount > prevPaid) {
        setToast('💰 Pagamento Confirmado!');
        setTimeout(() => setToast(null), 8000);
        new Audio('https://actions.google.com/sounds/v1/foley/cash_register_kaching.ogg').play().catch(() => {});
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Pix Recebido!', { body: 'Uma reserva acabou de ser paga.', icon: '/banner.png' });
        }
      }
    }

    if (numbersData.length > 0) {
      setIsFirstLoad(false);
      setPrevPending(pendingCount);
      setPrevPaid(paidCount);
    }
  }, [numbersData, prevPending, prevPaid, isFirstLoad, auth]);

  const handleLogin = () => {
    if (adminUser.trim().toLowerCase() === 'admin' && pass === '253658Eb011125@') {
      setAuth(true);
      localStorage.setItem('isAdminLoggedIn', 'true');
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    } else {
      alert('Usuário ou senha incorretos!');
    }
  };

  const handleLogout = () => {
    setAuth(false);
    localStorage.removeItem('isAdminLoggedIn');
  };

  // ── LOGIN SCREEN ──
  if (!auth) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '20px', marginTop: '60px' }}>
        <div className="glass" style={{ width: '100%', maxWidth: '350px', textAlign: 'center', position: 'relative', padding: '36px 24px' }}>
          <button
            onClick={() => navigate('/')}
            style={{ position: 'absolute', top: '20px', left: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <ArrowLeft size={24} />
          </button>

          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔐</div>
          <h2 style={{ color: 'var(--primary-dark)', marginBottom: '6px', fontSize: '1.4rem' }}>Acesso Restrito</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '28px' }}>Área do Organizador</p>

          {/* Username */}
          <input
            type="text"
            className="input-field"
            style={{ marginBottom: '12px' }}
            value={adminUser}
            onChange={e => setAdminUser(e.target.value)}
            placeholder="Usuário (admin)"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />

          {/* Password */}
          <div style={{ position: 'relative', marginBottom: '24px' }}>
            <input
              type={showPass ? 'text' : 'password'}
              className="input-field"
              style={{ paddingRight: '44px' }}
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="Senha"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}
            >
              {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button className="btn btn-primary" onClick={handleLogin}>
            Entrar no Painel
          </button>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ──
  const totalNumbers = 100;
  const paidNumbers = numbersData.filter(n => n.status === 'PAID').length;
  const pendingNumbers = numbersData.filter(n => n.status === 'PENDING_PAYMENT' || n.status === 'RESERVED').length;
  const totalRevenue = paidNumbers * PRECO;

  const reservations = numbersData.filter(n => n.status !== 'AVAILABLE');
  const grouped = {};
  reservations.forEach(r => {
    const key = r.ownerWhatsApp || r.ownerName || r.number;
    if (!grouped[key]) {
      grouped[key] = { name: r.ownerName, whatsapp: r.ownerWhatsApp, numbers: [], status: 'PAID' };
    }
    grouped[key].numbers.push(r.number);
    if (r.status === 'PENDING_PAYMENT' || r.status === 'RESERVED') {
      grouped[key].status = 'PENDING_PAYMENT';
    }
  });
  const clients = Object.values(grouped).sort((a, b) => b.numbers.length - a.numbers.length);

  const sendWhatsAppReminder = (client) => {
    const text = `Olá ${client.name.split(' ')[0]}! Tudo bem? Vi que você reservou os números (${client.numbers.join(', ')}) no nosso Chá de Bebê. O pagamento de R$ ${(client.numbers.length * PRECO).toFixed(2).replace('.', ',')} está pendente. Não perca sua vaga!`;
    window.open(`https://wa.me/55${client.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const confirmCancel = async () => {
    if (!cancelClient) return;
    await cancelReservation(RAFFLE_ID, cancelClient.numbers);
    setCancelClient(null);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setEditName(client.name || '');
    setEditWhatsApp(client.whatsapp || '');
  };

  const saveEditClient = async () => {
    if (!editName || !editWhatsApp) { alert('Preencha nome e número.'); return; }
    await updateReservation(RAFFLE_ID, editingClient.numbers, editName, editWhatsApp);
    setEditingClient(null);
  };

  return (
    <div className="w-full animate-fade-in" style={{ padding: '0 12px 80px' }}>

      {/* Toast */}
      {toast && (
        <div className="animate-slide-up" style={toastStyle}>
          <Bell size={16} /> {toast}
        </div>
      )}

      {/* Edit Modal */}
      {editingClient && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle} className="animate-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--primary-dark)', fontSize: '1.2rem' }}>Editar Cliente</h3>
              <button onClick={() => setEditingClient(null)} style={iconBtnStyle}><X size={24} /></button>
            </div>
            <label style={labelStyle}>Nome Completo</label>
            <input className="input-field" value={editName} onChange={e => setEditName(e.target.value)} style={{ marginBottom: '16px' }} />
            <label style={labelStyle}>WhatsApp</label>
            <input className="input-field" value={editWhatsApp} type="tel" onChange={e => setEditWhatsApp(e.target.value)} style={{ marginBottom: '24px' }} />
            <button className="btn btn-primary" onClick={saveEditClient}>Salvar Alterações <Check size={18} /></button>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelClient && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle} className="animate-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#FF3B30', fontSize: '1.2rem' }}>Cancelar Reserva?</h3>
              <button onClick={() => setCancelClient(null)} style={iconBtnStyle}><X size={24} /></button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.5' }}>
              Você está prestes a cancelar a compra de <strong>{cancelClient.name?.split(' ')[0]}</strong> e liberar os números <strong>{cancelClient.numbers.join(', ')}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn" onClick={() => setCancelClient(null)} style={{ flex: 1, background: '#F5F5F7', color: '#1D1D1F' }}>Voltar</button>
              <button className="btn btn-primary" onClick={confirmCancel} style={{ flex: 1, background: '#FF3B30', boxShadow: '0 4px 15px rgba(255,59,48,0.3)' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingTop: '12px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'var(--surface-solid)', border: '1px solid rgba(128,128,128,0.2)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--primary-dark)' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ color: 'var(--primary-dark)', margin: 0, fontSize: '1.4rem', flex: 1 }}>Painel</h1>
        <button onClick={handleLogout} style={{ background: '#ffebee', color: '#d32f2f', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>
          Sair
        </button>
      </div>

      {/* Dashboard Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        <div style={dashCardStyle}><div style={dashTitleStyle}>Arrecadado</div><div style={{ ...dashValueStyle, color: 'var(--primary-dark)' }}>R$ {totalRevenue.toFixed(2).replace('.', ',')}</div></div>
        <div style={dashCardStyle}><div style={dashTitleStyle}>Números Pagos</div><div style={{ ...dashValueStyle, color: '#34C759' }}>{paidNumbers}/{totalNumbers}</div></div>
        <div style={dashCardStyle}><div style={dashTitleStyle}>Aguardando Pix</div><div style={{ ...dashValueStyle, color: '#FF9500' }}>{pendingNumbers}</div></div>
        <div style={dashCardStyle}><div style={dashTitleStyle}>Livres</div><div style={{ ...dashValueStyle, color: '#007AFF' }}>{totalNumbers - paidNumbers - pendingNumbers}</div></div>
      </div>

      {/* Client List */}
      <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Dados de Pessoas ({clients.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {clients.map((client, idx) => (
          <div key={idx} style={{ background: 'var(--surface-solid)', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid rgba(128,128,128,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--primary-dark)' }}>{client.name}</h3>
                <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)' }}>{client.whatsapp}</p>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', background: client.status === 'PAID' ? '#EAF8F1' : '#FFF5E5', color: client.status === 'PAID' ? '#34C759' : '#FF9500' }}>
                {client.status === 'PAID' ? 'PAGO' : 'PENDENTE'}
              </span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '8px 12px', borderRadius: '10px', marginBottom: '14px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{client.numbers.length} número(s) • R$ {(client.numbers.length * PRECO).toFixed(2).replace('.', ',')}</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: '600', wordWrap: 'break-word' }}>{client.numbers.sort((a, b) => a - b).join(', ')}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              {client.status === 'PENDING_PAYMENT' && (
                <button onClick={() => sendWhatsAppReminder(client)} style={{ ...actionBtnStyle, background: '#EAF8F1', color: '#34C759' }}>
                  <MessageCircle size={14} /> Lembrar
                </button>
              )}
              <button onClick={() => openEditModal(client)} style={{ ...actionBtnStyle, background: '#F0F4FF', color: '#007AFF' }}>
                <Edit2 size={14} /> Editar
              </button>
              <button onClick={() => setCancelClient(client)} style={{ ...actionBtnStyle, background: '#FFF0F2', color: '#FF3B30' }}>
                <Trash2 size={14} /> Cancelar
              </button>
            </div>
          </div>
        ))}
        {clients.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'var(--surface-solid)', borderRadius: '16px' }}>
            Nenhuma reserva registrada ainda.
          </div>
        )}
      </div>
    </div>
  );
};

const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)' };
const iconBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', color: '#999' };

const dashCardStyle = {
  background: 'var(--surface-solid)',
  padding: '14px 16px',
  borderRadius: '16px',
  boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
  border: '1px solid rgba(128,128,128,0.05)'
};
const dashTitleStyle = { fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600' };
const dashValueStyle = { fontSize: '1.35rem', fontWeight: 'bold' };

const actionBtnStyle = {
  border: 'none', padding: '8px 14px', borderRadius: '20px',
  display: 'flex', alignItems: 'center', gap: '6px',
  fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap'
};

const modalOverlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
  zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
};
const modalContentStyle = {
  background: 'var(--surface-solid)', width: '100%', maxWidth: '400px',
  padding: '24px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
};
const toastStyle = {
  position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
  background: '#1D1D1F', color: 'white', padding: '10px 20px',
  borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)', zIndex: 9999, fontWeight: '600', fontSize: '0.85rem'
};

export default Admin;
