import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Music, Upload, CheckCircle, Activity, LayoutDashboard, Copy, Settings as SettingsIcon, Plus, Play, Pause, RefreshCw, Trash2, Tag, LogOut, ArrowLeft, Sun, Moon, Bell, MessageCircle, Eye, EyeOff, Edit2, X, Check, Clock, PauseCircle, PlayCircle, Search, ImageIcon } from 'lucide-react';
import { listenToNumbers, listenToRaffles, createRaffle, updateRaffle, cancelReservation, updateReservation, eraseHistory, getSettings, updateSettings, uploadFile } from '../services/firebaseService';
import { refundPayment } from '../services/paymentService';
import { playDing, playCashRegister, initAudio } from '../services/soundService';
import ImageCropper from '../components/ImageCropper';
import { initPushNotifications } from '../services/pushService';

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
  const [notifPermission, setNotifPermission] = useState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default');

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

  // Multi-Raffle States
  const [raffles, setRaffles] = useState([]);
  const [activeRaffleId, setActiveRaffleId] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | manage

  // Create Raffle States
  const [newRaffle, setNewRaffle] = useState({ title: '', totalNumbers: 100, price: 0.01, instantWins: '' });
  const [isCreatingRaffle, setIsCreatingRaffle] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [croppedImageBlob, setCroppedImageBlob] = useState(null);
  const [croppedImagePreview, setCroppedImagePreview] = useState(null);
  const [globalSettings, setGlobalSettings] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Listen to all raffles
  useEffect(() => {
    if (!auth) return;
    initPushNotifications();
    
    getSettings().then(setGlobalSettings);

    const unsubscribe = listenToRaffles((data) => {
      setRaffles(data);
      if (!activeRaffleId && data.length > 0) {
        setActiveRaffleId(data[0].id);
      }
    });
    return () => unsubscribe();
  }, [auth, activeRaffleId]);

  // Firebase listener for selected raffle numbers
  useEffect(() => {
    if (!auth || !activeRaffleId) return;
    setNumbersData([]); // Reset when switching
    setIsFirstLoad(true);
    const unsubscribe = listenToNumbers(activeRaffleId, (data) => {
      setNumbersData(data);
    });
    return () => unsubscribe();
  }, [auth, activeRaffleId]);

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

  // ── DASHBOARD CALCULATIONS ──────────────────────────────────────────────────
  const currentRaffle = raffles.find(r => r.id === activeRaffleId) || { title: 'Carregando...', price: 0.01, totalNumbers: 100 };
  const totalNumbers = currentRaffle.totalNumbers || 100;
  const PRECO = currentRaffle.price || 0.01;

  const paidNumbers = numbersData.filter(n => n.status === 'PAID').length;
  const pendingNumbers = numbersData.filter(n => n.status === 'PENDING_PAYMENT' || n.status === 'RESERVED').length;
  const totalRevenue = paidNumbers * PRECO;

  const reservations = numbersData.filter(n => n.status !== 'AVAILABLE');
  const grouped = {};
  reservations.forEach(r => {
    const key = r.ownerWhatsApp || r.ownerName || r.number;
    if (!grouped[key]) {
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

  const sendWhatsAppRecovery = (client) => {
    const lines = [
      'Oi! Tudo bem? 😊',
      '',
      `Vi que você gerou um PIX para a nossa rifa (${currentRaffle.title}) mas os números expiraram.`,
      '',
      'Ainda dá tempo de garantir a sua chance de ganhar! Quer que eu gere um novo Pix para você?',
      '',
      'Aguardo seu retorno! ✨'
    ];
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${client.whatsapp.replace(/\D/g, '')}?text=${text}`, '_blank');
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

  const handleCancelClient = async (client) => {
    if (client.status === 'PAID') {
      const confirm = window.confirm(`Deseja ESTORNAR o pagamento de ${client.name?.split(' ')[0]} e liberar os números? O valor será devolvido automaticamente via Mercado Pago.`);
      if (!confirm) return;

      const numData = numbersData.find(n => client.numbers.includes(n.number) && n.transactionId);
      const txid = numData?.transactionId;
      if (!txid) {
        alert('ID da transação não encontrado. Estorno não pôde ser processado de forma automática.');
        return;
      }
      
      showToast('⏳ Processando estorno...');
      const res = await refundPayment(txid, activeRaffleId, client.numbers);
      if (res && res.success) {
        showToast('✅ Estorno realizado com sucesso! Números liberados.', 6000);
      } else {
        alert('Erro ao estornar: ' + (res?.error || 'Erro desconhecido no Mercado Pago.'));
      }
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
    try {
      const success = await cancelReservation(activeRaffleId, cancelClient.numbers);
      if (success) {
        setCancelClient(null);
        showToast('❌ Cancelado! Números liberados no site.');
      } else {
        showToast('Erro ao cancelar. Verifique a conexão.');
      }
    } catch (e) {
      showToast('Erro crítico: ' + e.message);
    }
  };

  const handleEraseHistory = async (client) => {
    if (!window.confirm(`Deseja APAGAR o histórico de ${client.name.split(' ')[0]}?`)) return;
    await eraseHistory(activeRaffleId, client.numbers);
    showToast('🗑️ Histórico apagado.');
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setEditName(client.name || '');
    setEditWhatsApp(client.whatsapp || '');
  };

  const saveEditClient = async () => {
    if (!editName || !editWhatsApp) { alert('Preencha nome e número.'); return; }
    await updateReservation(activeRaffleId, editingClient.numbers, editName, editWhatsApp);
    setEditingClient(null);
  };

  const confirmSaveEdit = async () => {
    if (editingClient) {
      const numbersToUpdate = editingClient.numbers;
      await updateReservation(activeRaffleId, numbersToUpdate, editName, editWhatsApp);
      setEditingClient(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setRawImageSrc(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedBlob) => {
    setCroppedImageBlob(croppedBlob);
    setCroppedImagePreview(URL.createObjectURL(croppedBlob));
    setRawImageSrc(null);
  };

  const generateRandomInstantWins = () => {
    const qty = parseInt(prompt("Quantos números aleatórios de Bônus deseja gerar? (Ex: 5)"), 10);
    if (!qty) return;
    const max = newRaffle.totalNumbers;
    const generated = new Set();
    while(generated.size < qty && generated.size < max) {
      generated.add(Math.floor(Math.random() * max) + 1);
    }
    setNewRaffle({...newRaffle, instantWins: Array.from(generated).join(', ')});
  };

  const handleAudioUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadProgress(1); // just a flag to show loading
    try {
      const path = `audio/${type}_${Date.now()}.mp3`;
      const url = await uploadFile(file, path);
      if (url) {
        await updateSettings({ [type]: url });
        setGlobalSettings(prev => ({ ...prev, [type]: url }));
        alert('Áudio atualizado com sucesso!');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao fazer upload do áudio');
    } finally {
      setUploadProgress(0);
    }
  };

  const handleCreateRaffle = async (e) => {
    e.preventDefault();
    if (!newRaffle.title || newRaffle.totalNumbers <= 0 || newRaffle.price <= 0) {
      alert("Preencha todos os campos corretamente.");
      return;
    }
    
    const parsedInstantWins = newRaffle.instantWins 
      ? newRaffle.instantWins.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
      : [];

    let uploadedImageUrl = null;
    if (croppedImageBlob) {
      setUploadProgress(1);
      const path = `raffles/cover_${Date.now()}.jpg`;
      uploadedImageUrl = await uploadFile(croppedImageBlob, path);
      setUploadProgress(0);
    }

    const id = await createRaffle({
      ...newRaffle,
      instantWins: parsedInstantWins,
      coverUrl: uploadedImageUrl
    });
    
    if (id) {
      setNewRaffle({ title: '', totalNumbers: 100, price: 0.01, instantWins: '' });
      setRawImageSrc(null);
      setCroppedImageBlob(null);
      setCroppedImagePreview(null);
      setIsCreatingRaffle(false);
      setActiveRaffleId(id);
      showToast('🎉 Rifa Criada com Sucesso!');
    } else {
      alert("Erro ao criar rifa.");
    }
  };

  const toggleRaffleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    await updateRaffle(id, { status: newStatus });
    showToast(`Rifa ${newStatus === 'PAUSED' ? 'Pausada' : 'Ativada'}!`);
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
            <button onClick={() => navigate('/')} style={{ background: 'var(--surface-solid)', border: '1px solid rgba(128,128,128,0.1)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '10px', borderRadius: '50%', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
              <Home size={24} />
            </button>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button 
                onClick={() => {
                  const isNowDark = document.body.classList.toggle('dark');
                  localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
                  // Trigger a re-render just to update the icon visually if needed
                  setNow(Date.now() + 1);
                }} 
                style={{ background: 'var(--surface-solid)', border: '1px solid rgba(128,128,128,0.1)', cursor: 'pointer', color: 'var(--text-color)', display: 'flex', padding: '10px', borderRadius: '50%', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}
              >
                {document.body.classList.contains('dark') ? <Sun size={24} className="animate-spin-slower" color="#5AC8FA" /> : <Moon size={24} className="animate-spin-slow" color="#FF9500" />}
              </button>
              <button onClick={handleLogout} style={{ background: '#FFF0F2', color: '#FF3B30', border: 'none', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
                Sair
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', background: 'var(--surface-solid)', padding: '6px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <button 
              onClick={() => setActiveTab('dashboard')} 
              style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '12px', background: activeTab === 'dashboard' ? 'var(--primary-light)' : 'transparent', color: activeTab === 'dashboard' ? 'var(--primary-dark)' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('manage')} 
              style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '12px', background: activeTab === 'manage' ? 'var(--primary-light)' : 'transparent', color: activeTab === 'manage' ? 'var(--primary-dark)' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Gerenciar Rifas
            </button>
          </div>

          {activeTab === 'dashboard' && (
            <div className="animate-fade-in">
              {/* Raffle Selector */}
              {raffles.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>Rifa Selecionada:</label>
                  <select 
                    value={activeRaffleId} 
                    onChange={e => setActiveRaffleId(e.target.value)}
                    style={{ width: '100%', padding: '14px', borderRadius: '14px', border: 'none', background: 'var(--surface-solid)', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', fontSize: '1rem', color: 'var(--primary-dark)', fontWeight: 'bold', outline: 'none' }}
                  >
                    {raffles.map(r => (
                      <option key={r.id} value={r.id}>{r.title} ({r.totalNumbers} números)</option>
                    ))}
                  </select>
                </div>
              )}

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
              {/* Dashboard Cards - Kiwify Style */}
              <div style={{ background: '#121214', margin: '-16px -16px 24px -16px', padding: '24px 16px', borderRadius: '0 0 24px 24px', position: 'relative', overflow: 'hidden' }}>
                {/* Decorative gradients */}
                <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'rgba(0, 230, 118, 0.15)', filter: 'blur(50px)', borderRadius: '50%' }}></div>
                <div style={{ position: 'absolute', bottom: -50, left: -50, width: 150, height: 150, background: 'rgba(0, 122, 255, 0.15)', filter: 'blur(50px)', borderRadius: '50%' }}></div>
                
                <h2 style={{ color: '#FFFFFF', margin: '0 0 16px 0', fontSize: '1.2rem', position: 'relative', zIndex: 1 }}>Visão Geral</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', position: 'relative', zIndex: 1 }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#A0A0A5', marginBottom: '8px', fontWeight: '500' }}>Vendas Totais</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#00E676', textShadow: '0 0 20px rgba(0,230,118,0.4)' }}>
                      R$ {totalRevenue.toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                  
                  <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#A0A0A5', marginBottom: '8px', fontWeight: '500' }}>Números Pagos</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#FFFFFF' }}>
                      {paidNumbers}<span style={{ fontSize: '0.9rem', color: '#666' }}>/{totalNumbers}</span>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#A0A0A5', marginBottom: '8px', fontWeight: '500' }}>Aguardando Pix</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#FF9F0A', textShadow: '0 0 20px rgba(255,159,10,0.3)' }}>
                      {pendingNumbers}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#A0A0A5', marginBottom: '8px', fontWeight: '500' }}>Livres</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0A84FF', textShadow: '0 0 20px rgba(10,132,255,0.3)' }}>
                      {totalNumbers - paidNumbers - pendingNumbers}
                    </div>
                  </div>
                </div>
              </div>

              {/* Abandonos Recentes Section */}
              {clients.filter(c => c.status === 'CANCELED' && c.whatsapp).length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '1rem', color: '#FF3B30', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🔥 Carrinhos Abandonados ({clients.filter(c => c.status === 'CANCELED' && c.whatsapp).length})
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {clients.filter(c => c.status === 'CANCELED' && c.whatsapp).map((client, idx) => (
                      <div key={`abandono-${idx}`} style={{ background: '#FFF0F2', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,59,48,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#FF3B30' }}>{client.name}</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{client.whatsapp}</p>
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#FF3B30', background: 'rgba(255,59,48,0.1)', padding: '4px 8px', borderRadius: '12px' }}>Expirado</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          Tentou comprar {client.numbers.length} número(s)
                        </div>
                        <button onClick={() => sendWhatsAppRecovery(client)} style={{ width: '100%', padding: '10px', background: '#25D366', color: '#FFF', border: 'none', borderRadius: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <MessageCircle size={16} /> Recuperar Venda
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '4px' }}>
                {client.status === 'PENDING_PAYMENT' && (
                  <button onClick={() => sendWhatsAppReminder(client)} style={{ ...actionBtnStyle, background: '#EAF8F1', color: '#34C759', padding: '10px 0' }}>
                    <MessageCircle size={16} /> Lembrar
                  </button>
                )}
                {client.status === 'PENDING_PAYMENT' && (
                  <button onClick={() => verifyPayment(client)} style={{ ...actionBtnStyle, background: '#F0F8FF', color: '#007AFF', border: '1px solid #007AFF', padding: '10px 0' }}>
                    <Search size={16} /> Verificar
                  </button>
                )}
                <button onClick={() => openEditModal(client)} style={{ ...actionBtnStyle, background: '#F0F4FF', color: '#007AFF', padding: '10px 0' }}>
                  <Edit2 size={16} /> Editar
                </button>
                {client.status !== 'CANCELED' && (
                  <button onClick={() => handleCancelClient(client)} style={{ ...actionBtnStyle, background: '#FFF0F2', color: '#FF3B30', padding: '10px 0' }}>
                    <Trash2 size={16} /> {client.status === 'PAID' ? 'Estornar' : 'Cancelar'}
                  </button>
                )}
                {client.status === 'CANCELED' && (
                  <button onClick={() => handleEraseHistory(client)} style={{ ...actionBtnStyle, background: '#FFF0F2', color: '#FF3B30', padding: '10px 0', gridColumn: 'span 2' }}>
                    <Trash2 size={16} /> Apagar do Histórico
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
      )}

      {activeTab === 'manage' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Criar Nova Rifa Form */}
          <div style={{ background: 'var(--surface-solid)', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', cursor: 'pointer' }} onClick={() => setIsCreatingRaffle(!isCreatingRaffle)}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} /> Criar Nova Rifa
              </h3>
              <div style={{ transform: isCreatingRaffle ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>
                <Plus size={20} color="var(--text-muted)" />
              </div>
            </div>

            {isCreatingRaffle && (
              <form onSubmit={handleCreateRaffle} className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '16px' }}>
                <div>
                  <label style={labelStyle}>Nome da Rifa</label>
                  <input type="text" required placeholder="Ex: Chá Rifa do Arthur" className="input-field" value={newRaffle.title} onChange={e => setNewRaffle({...newRaffle, title: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Qtd. Números</label>
                    <input type="number" required min="1" className="input-field" value={newRaffle.totalNumbers} onChange={e => setNewRaffle({...newRaffle, totalNumbers: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <label style={labelStyle}>Preço (R$)</label>
                    <input type="number" required min="0.01" step="0.01" className="input-field" value={newRaffle.price} onChange={e => setNewRaffle({...newRaffle, price: parseFloat(e.target.value)})} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Números Bônus (Vírgula)</label>
                    <input type="text" placeholder="Ex: 5, 20, 88" className="input-field" value={newRaffle.instantWins} onChange={e => setNewRaffle({...newRaffle, instantWins: e.target.value})} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button type="button" onClick={generateRandomInstantWins} className="btn" style={{ background: '#FFF3E0', color: '#FF9500', padding: '14px', width: '100%', border: 'none' }}>
                      🎲 Gerar Aleatórios
                    </button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Imagem de Fundo (Opcional)</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input type="file" accept="image/*" id="raffleImageInput" style={{ display: 'none' }} onChange={handleFileChange} />
                    <button type="button" onClick={() => document.getElementById('raffleImageInput').click()} className="btn" style={{ background: '#F0F4FF', color: '#007AFF', padding: '14px', border: '1px dashed #007AFF', flex: 1 }}>
                      📸 Escolher Imagem
                    </button>
                    {croppedImagePreview && (
                      <img src={croppedImagePreview} alt="Preview" style={{ width: '45px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                    )}
                  </div>
                </div>
                {/* Simplified Coupon generation for now */}
                <div>
                  <label style={labelStyle}>Cupom (Ex: Leve 10 Pague Menos)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#999' }}>*Ajustaremos cupons detalhados em breve*</span>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                  {uploadProgress === 1 ? 'Enviando Imagem...' : 'Criar Rifa'}
                </button>
              </form>
            )}
          </div>

          {/* Render Cropper se tiver imagem bruta */}
          {rawImageSrc && (
            <ImageCropper 
              imageSrc={rawImageSrc} 
              onCropComplete={handleCropComplete} 
              onCancel={() => setRawImageSrc(null)} 
            />
          )}

          {/* Lista de Rifas Existentes */}
          <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '-8px' }}>Rifas Atuais ({raffles.length})</h2>
          {raffles.map(raffle => (
            <div key={raffle.id} style={{ background: 'var(--surface-solid)', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: raffle.status === 'PAUSED' ? '4px solid #FF9500' : '4px solid #34C759' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: 'var(--primary-dark)' }}>{raffle.title}</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{raffle.totalNumbers} números • R$ {raffle.price?.toFixed(2).replace('.', ',')}</p>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', background: raffle.status === 'PAUSED' ? '#FFF3E0' : '#E8F5E9', color: raffle.status === 'PAUSED' ? '#FF9500' : '#34C759' }}>
                  {raffle.status === 'PAUSED' ? 'EM MANUTENÇÃO' : 'ATIVA'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button onClick={() => { setActiveRaffleId(raffle.id); setActiveTab('dashboard'); }} className="btn" style={{ flex: 1, padding: '10px', background: '#F0F4FF', color: '#007AFF', border: 'none' }}>
                  <Eye size={18} style={{ marginRight: '6px' }} /> Ver Painel
                </button>
                <button onClick={() => toggleRaffleStatus(raffle.id, raffle.status)} className="btn" style={{ flex: 1, padding: '10px', background: raffle.status === 'PAUSED' ? '#E8F5E9' : '#FFF3E0', color: raffle.status === 'PAUSED' ? '#34C759' : '#FF9500', border: 'none' }}>
                  {raffle.status === 'PAUSED' ? <><PlayCircle size={18} style={{ marginRight: '6px' }} /> Reativar</> : <><PauseCircle size={18} style={{ marginRight: '6px' }} /> Pausar Rifa</>}
                </button>
              </div>
            </div>
          ))}
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
