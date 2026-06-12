import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenToNumbers, reserveNumbers, cancelReservation, listenToRaffles, getSettings } from '../services/firebaseService';
import { generatePix } from '../services/paymentService';
import { loadCustomAudios } from '../services/soundService';
import NumberGrid from '../components/NumberGrid';
import BottomSheetModal from '../components/BottomSheetModal';
import { Copy, QrCode, CheckCircle, ChevronRight, Check, Sparkles, Clock as ClockIcon, Baby, Sun, Moon } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://rifas-baby-go.onrender.com/api';

const heroStyle = {
  width: '100%',
  padding: '40px 20px 20px',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const Home = () => {
  const navigate = useNavigate();
  const [numbersData, setNumbersData] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [adminTaps, setAdminTaps] = useState(0);
  const adminTapRef = React.useRef(null);
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark'));
  
  // Checkout State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [pixData, setPixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  // Active Raffle State
  const [raffle, setRaffle] = useState(null);

  // Countdown Timer
  useEffect(() => {
    let timer;
    if (pixData && !pixData.paid && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && pixData && !pixData.paid) {
      alert("Tempo esgotado! Seus números voltaram a ficar disponíveis.");
      setIsModalOpen(false);
      setPixData(null);
      setSelectedNumbers([]);
      setTimeLeft(300);
    }
    return () => clearInterval(timer);
  }, [pixData, timeLeft]);

  // Real-time Payment Success Check
  useEffect(() => {
    if (pixData && !pixData.paid && selectedNumbers.length > 0) {
      const allPaid = selectedNumbers.every(num => {
        const data = numbersData.find(n => n.number === num);
        return data && data.status === 'PAID';
      });
      if (allPaid) {
        setPixData(prev => ({ ...prev, paid: true }));
        try {
          if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        } catch (e) {}
        import('canvas-confetti').then((module) => {
          const confetti = module.default;
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#00E676', '#34C759', '#FFD700', '#FF9F0A']
          });
        });

        // Achou Ganhou Logic
        const instantWins = raffle?.instantWins || [];
        const foundWins = selectedNumbers.filter(n => instantWins.includes(n));
        if (foundWins.length > 0) {
          setTimeout(() => {
            alert(`🎉 ACHOU GANHOU! 🎉\n\nParabéns! Você encontrou os seguintes números premiados: ${foundWins.join(', ')}\n\nTire um print desta tela e envie para o administrador para receber seu prêmio na hora!`);
          }, 1500);
        }
      }
    }
  }, [numbersData, pixData, selectedNumbers, raffle]);

  useEffect(() => {
    const unsubscribe = listenToRaffles((raffles) => {
      // Find the first non-finished raffle
      const active = raffles.find(r => r.status === 'ACTIVE' || r.status === 'PAUSED');
      setRaffle(active || null);
    });

    // Load custom audios from settings
    getSettings().then(settings => {
      if (settings) {
        loadCustomAudios(settings);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!raffle?.id) return;
    const unsubscribe = listenToNumbers(raffle.id, (data) => {
      setNumbersData(data);
    });
    return () => unsubscribe();
  }, [raffle?.id]);

  // ── Payment Polling Fallback ──────────────────────────────────────────────────
  // If webhook fails (Render cold-start), frontend polls every 15s while Pix is open
  useEffect(() => {
    if (!pixData || pixData.paid || !pixData.chargeId) return;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/pix/check/${pixData.chargeId}`);
        const data = await res.json();
        if (data.approved) {
          console.log('[Poll] Pagamento confirmado via polling!');
          setPixData(prev => ({ ...prev, paid: true }));
        }
      } catch (e) {
        console.warn('[Poll] Erro ao verificar:', e.message);
      }
    }, 15000); // Check every 15 seconds
    return () => clearInterval(pollInterval);
  }, [pixData]);

  const handleSelectNumber = (num) => {
    setSelectedNumbers(prev => {
      if (prev.includes(num)) return prev.filter(n => n !== num);
      return [...prev, num].sort((a, b) => a - b);
    });
  };

  const handleAutoPick = (qty) => {
    const total = raffle?.totalNumbers || 100;
    const available = [];
    for (let i = 1; i <= total; i++) {
      const isTaken = numbersData.some(n => n.number === i && n.status !== 'AVAILABLE' && n.status !== 'CANCELED');
      if (!isTaken && !selectedNumbers.includes(i)) {
        available.push(i);
      }
    }
    
    if (available.length < qty) {
      alert(`Apenas ${available.length} números livres no momento.`);
      qty = available.length;
    }
    
    if (qty > 0) {
      const shuffled = available.sort(() => 0.5 - Math.random());
      const picked = shuffled.slice(0, qty);
      setSelectedNumbers(prev => {
        const merged = new Set([...prev, ...picked]);
        return Array.from(merged).sort((a, b) => a - b);
      });
    }
  };

  const PRECO = Number(raffle?.price) || 0.01;
  const totalValue = selectedNumbers.length * PRECO;

  const handleWhatsAppChange = (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length > 10) v = `${v.slice(0, 10)}-${v.slice(10)}`;
    setWhatsapp(v);
  };

  const handleCheckoutClick = () => {
    if (!name || !whatsapp) {
      alert("Por favor, preencha nome e WhatsApp.");
      return;
    }
    if (whatsapp.replace(/\D/g, '').length < 10) {
      alert("Por favor, insira um WhatsApp válido com DDD.");
      return;
    }
    setConfirmModal(true);
  };

  const confirmCheckout = async () => {
    setConfirmModal(false);
    setLoading(true);
    setTimeLeft(300);

    try {
      const success = await reserveNumbers(raffle.id, selectedNumbers, { name, whatsapp });
      if (!success) {
        alert("Alguns números já foram reservados. Tente outros.");
        setLoading(false);
        return;
      }

      // 🎰 Roleta / Sorteio do Cupom Instantâneo
      let finalValue = totalValue;
      let wonCoupon = false;
      
      // Regra de exemplo: Comprou 10 ou mais números = tem 25% de chance de ganhar 15% de desconto
      if (selectedNumbers.length >= 10 && Math.random() < 0.25) {
        wonCoupon = true;
        finalValue = totalValue * 0.85; // 15% de desconto
        alert("🎉 PARABÉNS! Você comprou 10+ números e acabou de SORTEAR UM CUPOM de 15% de Desconto na sua compra!");
      }

      const data = await generatePix({
        customerName: name,
        customerPhone: whatsapp,
        numbers: selectedNumbers,
        value: finalValue,
        raffleId: raffle.id
      });

      // Normalise response from any backend format
      if (data && (data.success || data.pix || data.qrCode || data.payload)) {
        setPixData({
          paid: false,
          qrCode: data.qrCode || (data.pix && `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.pix.qr_code || data.payload || '')}`) || null,
          payload: data.payload || data.pix?.qr_code || '',
          chargeId: data.chargeId || data.pix?.id || null,
        });
      } else {
        await cancelReservation(raffle.id, selectedNumbers);
        alert('Não foi possível gerar o Pix. Verifique sua conexão e tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao gerar Pix:', error);
      await cancelReservation(raffle.id, selectedNumbers).catch(() => {});
      alert('Erro de conexão. Verifique seu sinal de internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = async () => {
    const payload = pixData?.payload;
    if (!payload) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(payload);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch (err) {
      console.error('Clipboard error:', err);
      alert('Seu navegador bloqueou a cópia automática. Por favor, segure o texto do código Pix abaixo para copiar manualmente.');
    }
  };

  const handleSendReceipt = () => {
    const valor = (selectedNumbers.length * PRECO).toFixed(2).replace('.', ',');
    const nums = selectedNumbers.sort((a, b) => a - b).join(', ');
    const dataAtual = new Date().toLocaleString('pt-BR');
    
    const lines = [
      '✅ *Comprovante de Reserva - Rifa Baby*',
      '',
      `👤 *Nome:* ${name}`,
      `🎫 *Números Pagos:* ${nums}`,
      `💰 *Valor Total:* R$ ${valor}`,
      `📅 *Data do Pagamento:* ${dataAtual}`,
      '',
      'Pagamento aprovado com sucesso! 🎉'
    ];
    
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  const handleCancel = async () => {
    if (!raffle?.id) return;
    if (window.confirm("Deseja realmente cancelar a reserva e liberar seus números para outras pessoas?")) {
      await cancelReservation(raffle.id, selectedNumbers);
      setIsModalOpen(false);
      setPixData(null);
      setSelectedNumbers([]);
      setTimeLeft(300);
    }
  };

  const handleAdminTap = () => {
    const newCount = adminTaps + 1;
    setAdminTaps(newCount);
    if (adminTapRef.current) clearTimeout(adminTapRef.current);
    if (newCount >= 3) {
      setAdminTaps(0);
      navigate('/admin');
      return;
    }
    adminTapRef.current = setTimeout(() => setAdminTaps(0), 1200);
  };

  if (!raffle) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', background: 'var(--background)' }}>
        <div style={{ background: 'var(--surface-solid)', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', background: '#FFECF0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#FF6B81' }}>
            <Baby size={48} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-color)' }}>Nenhuma rifa ativa</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '0' }}>O organizador está preparando novidades incríveis. Volte em breve para não perder!</p>
        </div>
      </div>
    );
  }

  const isPaused = raffle.status === 'PAUSED';

  return (
    <div className={`app-container animate-fade-in ${isPaused ? 'blurred' : ''}`} style={{ filter: isPaused ? 'blur(4px)' : 'none', pointerEvents: isPaused ? 'none' : 'auto', paddingBottom: '40px' }}>
      
      {isPaused && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(10px)', pointerEvents: 'auto', padding: '24px', textAlign: 'center' }}>
          <ClockIcon size={48} color="#FF9500" style={{ marginBottom: '16px' }} />
          <h2 style={{ color: 'var(--primary-dark)', fontSize: '1.8rem', marginBottom: '12px' }}>Rifa Pausada para Manutenção</h2>
          <p style={{ color: 'var(--text-color)', fontSize: '1.1rem', maxWidth: '300px', lineHeight: '1.5' }}>
            Não se preocupe. Nenhum valor pago será perdido. Aguarde alguns instantes enquanto organizamos o sistema.
          </p>
        </div>
      )}

      <div 
        style={{
          width: '100%',
          maxWidth: '400px',
          height: '250px',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '0 0 24px 24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          background: '#000',
          margin: '0 auto'
        }}
      >
        <img 
          src={raffle.coverUrl || "/baby_shower_header.png"} 
          alt="Banner Rifa"
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
          onError={(e) => { e.target.onerror = null; e.target.src = "/baby_shower_header.png" }}
        />
        {/* Gradiente sutil em cima e embaixo */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)' }}></div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}></div>
        
        {/* Theme Toggle Floating Button */}
        <button 
          onClick={() => {
            const nowDark = document.body.classList.toggle('dark');
            localStorage.setItem('theme', nowDark ? 'dark' : 'light');
            setIsDark(nowDark);
          }}
          style={{ 
            position: 'absolute', top: '16px', right: '16px', zIndex: 10,
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.3)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: '10px', borderRadius: '50%',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
          }}
        >
          {isDark ? <Sun size={24} className="animate-spin-slower" color="#22D3EE" /> : <Moon size={24} className="animate-spin-slow" color="#FCD34D" />}
        </button>
        
        {/* Texto do Header */}
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }} onClick={handleAdminTap}>
            <span style={{ background: 'var(--accent-pink)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'inline-block' }}>
              Ativa Agora
            </span>
            <h1 style={{ color: 'white', margin: 0, fontSize: '1.5rem', fontWeight: '800', lineHeight: '1.1' }}>
              {raffle.title || "Rifa"}
            </h1>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', padding: '10px 14px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.3)', color: 'white', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <span style={{ fontSize: '0.7rem', opacity: 0.9, fontWeight: '600' }}>Preço Fixo</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'baseline', gap: '2px' }}>
              <span style={{ fontSize: '0.8rem' }}>R$</span> {PRECO.toFixed(2).replace('.', ',')}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: '5px' }}>
        <div className="glass" style={{ padding: '20px', background: 'var(--surface-solid)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)', margin: 0 }}>Números</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {localStorage.getItem('clientSessionPhone') && (
                <button onClick={() => navigate('/meus-numeros')} style={{ background: '#F0F4FF', color: '#007AFF', border: 'none', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                  Meus Números
                </button>
              )}
              <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>R$ {PRECO.toFixed(2).replace('.',',')}</span>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <p className="animate-pulse" style={{ color: '#FF3B30', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '12px', textAlign: 'center' }}>
              🔥 Faltam {raffle?.totalNumbers ? (raffle.totalNumbers - numbersData.filter(n => n.status !== 'AVAILABLE' && n.status !== 'CANCELED').length) : 100} números!
            </p>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
              <button className="btn" onClick={() => handleAutoPick(5)} style={{ flex: 1, padding: '8px', background: 'var(--accent-pink)', color: '#FFF', fontSize: '0.85rem' }}>
                <Sparkles size={14} style={{ display: 'inline', marginRight: '4px' }} /> Surpresa +5
              </button>
              <button className="btn" onClick={() => handleAutoPick(10)} style={{ flex: 1, padding: '8px', background: '#FF9500', color: '#FFF', fontSize: '0.85rem' }}>
                <Sparkles size={14} style={{ display: 'inline', marginRight: '4px' }} /> Surpresa +10
              </button>
              <button className="btn" onClick={() => handleAutoPick(20)} style={{ flex: 1, padding: '8px', background: '#34C759', color: '#FFF', fontSize: '0.85rem' }}>
                <Sparkles size={14} style={{ display: 'inline', marginRight: '4px' }} /> Surpresa +20
              </button>
            </div>
          </div>
          
          <NumberGrid 
            totalNumbers={100}
            numbersData={numbersData}
            selectedNumbers={selectedNumbers}
            onSelectNumber={handleSelectNumber}
          />

          {selectedNumbers.length > 0 && (
            <div className="animate-slide-up" style={{ marginTop: '20px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  {selectedNumbers.length} número(s)
                </p>
                <h3 style={{ fontSize: '1.4rem', color: 'var(--primary-dark)' }}>
                  R$ {totalValue.toFixed(2).replace('.', ',')}
                </h3>
              </div>
              <button className="btn btn-primary" style={{ width: 'auto', padding: '12px 20px' }} onClick={() => setIsModalOpen(true)}>
                Continuar <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomSheetModal isOpen={isModalOpen} onClose={() => { 
        // Only allow closing the modal if there's no active pix session
        if (!loading && !pixData) setIsModalOpen(false);
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⏳</div>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--primary-dark)', marginBottom: '8px' }}>Gerando seu Pix...</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Aguarde, isso pode levar alguns segundos.</p>
          </div>
        ) : !pixData ? (
          <div className="animate-fade-in">
            {confirmModal ? (
              <div className="text-center">
                <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Confirmar Dados</h2>
                <p style={{ marginBottom: '20px' }}>{name}, Você está prestes a gerar o Pix para reservar os números: <strong style={{ color: 'var(--accent-blue)' }}>{selectedNumbers.sort((a,b)=>a-b).join(', ')}</strong>.
          </p>
          
          <div style={{ background: 'var(--background)', padding: '12px', borderRadius: '12px', marginBottom: '20px', textAlign: 'left' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Nome: <strong style={{ color: 'var(--text-main)' }}>{name}</strong></p>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>WhatsApp: <strong style={{ color: 'var(--text-main)' }}>{whatsapp}</strong></p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={() => setConfirmModal(false)}>Voltar</button>
                  <button className="btn btn-primary" onClick={confirmCheckout}>Confirmar Reserva</button>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in">
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--primary-dark)' }}>Finalizar Compra</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Preencha seus dados para gerar o Pix.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <input 
                    className="input-field" 
                    placeholder="Seu Nome Completo" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                  />
                  <input 
                    type="tel"
                    className="input-field" 
                    style={{ marginBottom: '24px' }}
                    value={whatsapp} 
                    onChange={handleWhatsAppChange} 
                    placeholder="(11) 99999-9999"
                    maxLength="15"
                  />
                </div>

                <button 
                  className="btn btn-primary" 
                  onClick={handleCheckoutClick}
                  disabled={loading}
                >
                  {loading ? 'Processando...' : <><QrCode size={20} /> Gerar Pix de R$ {totalValue.toFixed(2).replace('.', ',')}</>}
                </button>
              </div>
            )}
          </div>
        ) : pixData.paid ? (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: '#34C759' }}>
              <CheckCircle size={64} />
            </div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '8px', color: 'var(--primary-dark)' }}>Pagamento Aprovado!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '1.1rem' }}>
              Parabéns, {name.split(' ')[0]}! Seus números ({selectedNumbers.join(', ')}) já estão garantidos e pagos.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="btn" 
                onClick={handleSendReceipt} 
                style={{ background: '#25D366', color: '#FFF', fontWeight: 'bold' }}
              >
                Enviar p/ meu WhatsApp
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setIsModalOpen(false);
                  setPixData(null);
                  setSelectedNumbers([]);
                  localStorage.setItem('clientSessionPhone', whatsapp.replace(/\D/g, ''));
                  localStorage.setItem('clientName', name);
                  navigate('/meus-numeros');
                }}
              >
                Concluir <Check size={20} />
              </button>
            </div>
          </div>
        ) : (
            <div className="animate-fade-in" style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--accent)' }}>
                <CheckCircle size={48} />
              </div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '4px', color: 'var(--primary-dark)' }}>Quase Lá, {name.split(' ')[0]}!</h2>
              <div className="pulse-timer" style={{ background: '#FFF0F2', padding: '6px 16px', borderRadius: '20px', display: 'inline-block', marginBottom: '20px', animation: 'pulse 1.5s infinite' }}>
                <span style={{ color: '#FF6B81', fontWeight: 'bold' }}>
                  ⏳ Expira em: {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Copie a chave abaixo ou escaneie o QR Code.</p>
            
            {(pixData.qrCode || pixData.pix?.qr_code) && (
              <img 
                src={pixData.qrCode || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${pixData.pix?.qr_code}`} 
                alt="QR Code Pix" 
                style={{ width: '180px', height: '180px', margin: '0 auto 24px', borderRadius: '16px', border: '1px solid #eee' }} 
              />
            )}

            <button className="btn btn-secondary" onClick={handleCopyPix} style={{ marginBottom: '8px' }}>
              {copied ? <><Check size={20} /> Copiado!</> : <><Copy size={20} /> Copiar Chave Pix</>}
            </button>

            {/* Selectable fallback for manual copy */}
            <div
              style={{ 
                background: 'rgba(0,0,0,0.04)', borderRadius: '10px', padding: '10px 14px',
                marginBottom: '12px', fontSize: '0.72rem', color: 'var(--text-muted)',
                wordBreak: 'break-all', textAlign: 'left', userSelect: 'text',
                border: '1px dashed rgba(0,0,0,0.1)', cursor: 'text'
              }}
              onClick={e => {
                const range = document.createRange();
                range.selectNodeContents(e.currentTarget);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
              }}
            >
              {pixData?.payload || 'Chave não disponível'}
            </div>

            <button 
              className="btn btn-secondary" 
              onClick={handleCancel} 
              style={{ marginBottom: '12px', background: '#ffebee', color: '#d32f2f', border: 'none' }}
            >
              Cancelar Reserva
            </button>

            <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '16px' }}>
              Seus números ({selectedNumbers.join(', ')}) ficarão reservados aguardando o pagamento.
            </p>
          </div>
        )}
      </BottomSheetModal>

      <footer style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <p>Rifas Baby Go &copy; {new Date().getFullYear()}</p>
        {!localStorage.getItem('clientSessionPhone') && (
          <button onClick={() => navigate('/meus-numeros')} style={{ background: 'none', border: 'none', color: '#999', textDecoration: 'underline', marginTop: '8px', cursor: 'pointer' }}>
            Já fez uma reserva? Entre aqui
          </button>
        )}
      </footer>
    </div>
  );
};



export default Home;
