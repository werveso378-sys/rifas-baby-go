import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenToNumbers, cancelReservation, updateReservation, eraseHistory } from '../services/firebaseService';
import { playDing, playCashRegister, initAudio } from '../services/soundService';
import { MessageCircle, Bell, Eye, EyeOff, ArrowLeft, Trash2, Edit2, X, Check, Clock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://rifas-baby-go.onrender.com/api';
const VAPID_PUBLIC = 'BLqLhw2gqsuw7dX15HJmL9mx652r3FBViKcbjTYsvPf1BNGOiORuW8mAeoQHnb9d0h3ZB0XacxfriFq-FHm6FPY';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
};

const subscribeToPush = async () => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
    });
    await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() })
    });
    console.log('[Push] Assinatura registrada com sucesso!');
  } catch (e) {
    console.warn('[Push] Falha ao registrar assinatura:', e.message);
  }
};

const RAFFLE_ID = "baby_shower_01";
const PRECO = 0.01;

// Format seconds to MM:SS
const formatTime = (seconds) => {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const Admin = () => {
  const navigate = useNavigate();
  const [numbersData, setNumbersData] = useState([]);
  const [auth, setAuth] = useState(() => localStorage.getItem('isAdminLoggedIn') === 'true');
  const [pass, setPass] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Notification states
  const [toast, setToast] = useState(null);
  const [prevPending, setPrevPending] = useState(0);
  const [prevPaid, setPrevPaid] = useState(0);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [notifPermission, setNotifPermission] = useState(Notification.permission);

  // Modal states
  const [cancelClient, setCancelClient] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [editName, setEditName] = useState('');
  const [editWhatsApp, setEditWhatsApp] = useState('');

  // Clock tick — updates every second to power the countdown timers
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

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
        showToast('🚨 Nova reserva — Pix gerado!');
        playDing();
        sendBrowserNotification('Nova Reserva!', 'Um cliente gerou um Pix e está aguardando pagamento.');
      }
      if (paidCount > prevPaid) {
        showToast('💰 Pagamento Confirmado!', 8000);
        playCashRegister();
        sendBrowserNotification('💰 Pix Recebido!', 'Uma reserva acabou de ser paga com sucesso!');
      }
    }

    if (numbersData.length > 0) {
      setIsFirstLoad(false);
      setPrevPending(pendingCount);
      setPrevPaid(paidCount);
    }
  }, [numbersData, auth, isFirstLoad, prevPending, prevPaid]);

  const showToast = (msg, duration = 5000) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  };

  const sendBrowserNotification = (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/banner.png', badge: '/banner.png', vibrate: [200, 100, 200] });
    }
  };

  const handleLogin = () => {
    if (adminUser.trim().toLowerCase() === 'admin' && pass === '253658Eb011125@') {
      setAuth(true);
      localStorage.setItem('isAdminLoggedIn', 'true');
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission().then(permission => {
          setNotifPermission(permission);
          if (permission === 'granted') subscribeToPush();
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        subscribeToPush();
      }
    } else {
      alert('Usuário ou senha incorretos!');
    }
  };

  const handleLogout = () => {
    setAuth(false);
    localStorage.removeItem('isAdminLoggedIn');
  };

  // ── LOGIN SCREEN ──────────────────────────────────────────────────────────────
  if (!auth) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '20px', marginTop: '60px' }}>
        <div className="glass" style={{ width: '100%', maxWidth: '350px', textAlign: 'center', position: 'relative', padding: '36px 24px' }}>
          <button onClick={() => navigate('/')} style={{ position: 'absolute', top: '20px', left: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <ArrowLeft size={24} />
          </button>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔐</div>
          <h2 style={{ color: 'var(--primary-dark)', marginBottom: '6px', fontSize: '1.4rem' }}>Acesso Restrito</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '28px' }}>Área do Organizador</p>
          <input type="text" className="input-field" style={{ marginBottom: '12px' }} value={adminUser} onChange={e => setAdminUser(e.target.value)} placeholder="Usuário (admin)" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          <div style={{ position: 'relative', marginBottom: '24px' }}>
            <input type={showPass ? 'text' : 'password'} className="input-field" style={{ paddingRight: '44px' }} value={pass} onChange={e => setPass(e.target.value)} placeholder="Senha" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
              {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button className="btn btn-primary" onClick={handleLogin}>Entrar no Painel</button>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────────
  const totalNumbers = 100;
  const paidNumbers = numbersData.filter(n => n.status === 'PAID').length;
  const pendingNumbers = numbersData.filter(n => n.status === 'PENDING_PAYMENT' || n.status === 'RESERVED').length;
  const totalRevenue = paidNumbers * PRECO;

  const reservations = numbersData.filter(n => n.status !== 'AVAILABLE');
  const grouped = {};
  reservations.forEach(r => {
    const key = r.ownerWhatsApp || r.ownerName || r.number;
    if (!grouped[key]) {
      // Default to the first status encountered, or PAID if it's actually paid
      grouped[key] = { name: r.ownerName, whatsapp: r.ownerWhatsApp, numbers: [], status: r.status, expiresAt: null, pixPayload: r.pixPayload };
    }
    grouped[key].numbers.push(r.number);
    if (r.pixPayload) grouped[key].pixPayload = r.pixPayload; // Grab payload if any number has it

    // Prioritize PENDING over other statuses so we know if they still owe money
    if (r.status === 'PENDING_PAYMENT' || r.status === 'RESERVED') {
      grouped[key].status = 'PENDING_PAYMENT';
      if (r.expiresAt && (!grouped[key].expiresAt || r.expiresAt > grouped[key].expiresAt)) {
        grouped[key].expiresAt = r.expiresAt;
      }
    } else if (r.status === 'PAID') {
      // If we already have pending, keep pending. Otherwise upgrade to paid
      if (grouped[key].status !== 'PENDING_PAYMENT') grouped[key].status = 'PAID';
    }
  });
  const clients = Object.values(grouped).sort((a, b) => b.numbers.length - a.numbers.length);

  const getSecondsLeft = (expiresAt) => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  };

  const sendWhatsAppReminder = (client) => {
    const valor = (client.numbers.length * PRECO).toFixed(2).replace('.', ',');
    const nums = client.numbers.sort((a, b) => a - b).join(', ');
    const PIX_KEY = client.pixPayload || 'gabriellealmeidamascarenhas@gmail.com'; // Fallback só por segurança
    const lines = [
      '🍼✨ *Chá de Bebê - Rifa*',
      '',
      `Olá ${client.name.split(' ')[0]}! Tudo bem? 😊`,
      '',
      'Percebemos que você reservou os números abaixo mas o pagamento ainda não foi confirmado:',
      '',
      `🎫 *Número(s) reservado(s):* ${nums}`,
      `💰 *Valor total:* R$ ${valor}`,
      '',
      '*Pague com Pix Copia e Cola:*',
      `👇 Copie o código longo abaixo:`,
      `${PIX_KEY}`,
      '',
      'Abra seu banco, vá em "Pix Copia e Cola", cole o código e confirme. Fácil assim! 😎',
      '',
      '⚠️ Se não pagar em breve, os números voltam para outros participantes.',
      '',
      'Obrigado e boa sorte! 🍀'
    ];
    window.open(`https://wa.me/55${client.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  const handleCancelClient = (client) => {
    if (client.status === 'PAID') {
      // Already paid — cannot simply cancel, must refund via MP
      alert(`⚠️ ${client.name.split(' ')[0]} já realizou o pagamento!\n\nPara cancelar a compra, você precisa realizar o ESTORNO manualmente pelo painel do Mercado Pago:\n1. Acesse mercadopago.com.br\n2. Vá em "Sua atividade"\n3. Localize o pagamento e clique em "Estornar"\n\nApós o estorno, os números serão liberados.`);
      return;
    }
    setCancelClient(client);
  };

  const verifyPayment = async (client) => {
    // Find the transactionId from numbersData for this client
    const numData = numbersData.find(n => client.numbers.includes(n.number) && n.transactionId);
    const txid = numData?.transactionId;
    if (!txid) {
      alert('ID da transação não encontrado. O Pix pode não ter sido gerado ainda.');
      return;
    }
    showToast('🔍 Verificando pagamento...');
    try {
      const res = await fetch(`${API_URL}/pix/check/${txid}`);
      const data = await res.json();
      if (data.approved) {
        showToast('✅ Pagamento confirmado! Números atualizados.', 6000);
      } else {
        showToast(`⚠️ Status: ${data.status || 'pendente'}. Não confirmado ainda.`, 5000);
      }
    } catch (e) {
      showToast('Erro ao verificar. Tente novamente.', 4000);
    }
  };

  const confirmCancel = async () => {
    if (!cancelClient) return;
    await cancelReservation(RAFFLE_ID, cancelClient.numbers);
    setCancelClient(null);
    showToast('❌ Cancelado! Números liberados no site.');
  };

  const handleEraseHistory = async (client) => {
    if (!window.confirm(`Deseja APAGAR o histórico de ${client.name.split(' ')[0]}?`)) return;
    await eraseHistory(RAFFLE_ID, client.numbers);
    showToast('🗑️ Histórico apagado.');
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
    <div className="w-full animate-fade-in" style={{ padding: '0 12px 80px' }} onClick={initAudio}>

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
              Você está prestes a cancelar a reserva de <strong>{cancelClient.name?.split(' ')[0]}</strong> e liberar os números <strong>{cancelClient.numbers.join(', ')}</strong>. Isso não pode ser desfeito.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn" onClick={() => setCancelClient(null)} style={{ flex: 1, background: '#F5F5F7', color: '#1D1D1F' }}>Voltar</button>
              <button className="btn btn-primary" onClick={confirmCancel} style={{ flex: 1, background: '#FF3B30', boxShadow: '0 4px 15px rgba(255,59,48,0.3)' }}>Confirmar Cancelamento</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '400px', width: '100%', paddingBottom: '30px' }}>
          
          {/* Top Navbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingTop: '12px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}>
              <ArrowLeft size={24} /> Painel
            </button>
            <button onClick={handleLogout} style={{ background: '#FFF0F2', color: '#FF3B30', border: 'none', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
              Sair
            </button>
          </div>

          {/* Notification Warning Banner */}
          {notifPermission === 'denied' && (
            <div style={{ background: '#FFF0F2', border: '1px solid #FF3B30', color: '#FF3B30', padding: '12px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                <Bell size={18} /> Notificações Bloqueadas!
              </div>
              <span>O seu navegador bloqueou os alertas de pagamento. Clique no ícone de <b>Cadeado</b> (ou configurações) na barra de endereços lá em cima e mude "Notificações" para <b>Permitir</b>.</span>
            </div>
          )}

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
        {clients.map((client, idx) => {
          const secondsLeft = client.status === 'PENDING_PAYMENT' ? getSecondsLeft(client.expiresAt) : 0;
          const isExpiring = secondsLeft > 0 && secondsLeft < 60;

          return (
            <div key={idx} style={{ background: 'var(--surface-solid)', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: `1px solid ${isExpiring ? 'rgba(255,59,48,0.3)' : 'rgba(128,128,128,0.05)'}` }}>
              
              {/* Header do Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--primary-dark)' }}>{client.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)' }}>{client.whatsapp}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', background: client.status === 'PAID' ? '#EAF8F1' : client.status === 'CANCELED' ? '#F2F2F7' : '#FFF5E5', color: client.status === 'PAID' ? '#34C759' : client.status === 'CANCELED' ? '#8E8E93' : '#FF9500' }}>
                    {client.status === 'PAID' ? '✅ PAGO' : client.status === 'CANCELED' ? '❌ CANCELADO/EXPIRADO' : '⏳ PENDENTE'}
                  </span>
                  {/* Countdown Timer — only for pending */}
                  {client.status === 'PENDING_PAYMENT' && client.expiresAt && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: secondsLeft === 0 ? '#ffebee' : isExpiring ? '#FFF5E5' : 'rgba(0,0,0,0.04)', padding: '3px 8px', borderRadius: '12px' }}>
                      <Clock size={11} color={secondsLeft === 0 ? '#FF3B30' : isExpiring ? '#FF9500' : '#999'} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: secondsLeft === 0 ? '#FF3B30' : isExpiring ? '#FF9500' : '#999' }}>
                        {secondsLeft === 0 ? 'Expirado' : formatTime(secondsLeft)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Números */}
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: '8px 12px', borderRadius: '10px', marginBottom: '14px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{client.numbers.length} número(s) • R$ {(client.numbers.length * PRECO).toFixed(2).replace('.', ',')}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: '600', wordWrap: 'break-word' }}>{client.numbers.sort((a, b) => a - b).join(', ')}</p>
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
                {client.status === 'PENDING_PAYMENT' && (
                  <button onClick={() => sendWhatsAppReminder(client)} style={{ ...actionBtnStyle, background: '#EAF8F1', color: '#34C759' }}>
                    <MessageCircle size={14} /> Lembrar
                  </button>
                )}
                {client.status === 'PENDING_PAYMENT' && (
                  <button onClick={() => verifyPayment(client)} style={{ ...actionBtnStyle, background: '#F0F8FF', color: '#007AFF', border: '1px solid #007AFF' }}>
                    🔍 Verificar
                  </button>
                )}
                <button onClick={() => openEditModal(client)} style={{ ...actionBtnStyle, background: '#F0F4FF', color: '#007AFF' }}>
                  <Edit2 size={14} /> Editar
                </button>
                {client.status !== 'CANCELED' && (
                  <button onClick={() => handleCancelClient(client)} style={{ ...actionBtnStyle, background: '#FFF0F2', color: '#FF3B30' }}>
                    <Trash2 size={14} /> {client.status === 'PAID' ? 'Estornar' : 'Cancelar'}
                  </button>
                )}
                {client.status === 'CANCELED' && (
                  <button onClick={() => handleEraseHistory(client)} style={{ ...actionBtnStyle, background: '#FFF0F2', color: '#FF3B30' }}>
                    <Trash2 size={14} /> Apagar
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {clients.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'var(--surface-solid)', borderRadius: '16px' }}>
            Nenhuma reserva registrada ainda.
          </div>
        )}
      </div>
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
