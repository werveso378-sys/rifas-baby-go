import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listenToNumbers, reserveNumbers, cancelReservation } from '../services/firebaseService';
import { generatePix } from '../services/paymentService';
import NumberGrid from '../components/NumberGrid';
import BottomSheetModal from '../components/BottomSheetModal';
import { Copy, QrCode, CheckCircle, ChevronRight, Check, Sparkles } from 'lucide-react';

const PRECO = 0.01;
const RAFFLE_ID = "baby_shower_01";

const Home = () => {
  const navigate = useNavigate();
  const [numbersData, setNumbersData] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [secretClicks, setSecretClicks] = useState(0);
  
  // Checkout State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [pixData, setPixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

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
      }
    }
  }, [numbersData, pixData, selectedNumbers]);

  useEffect(() => {
    const unsubscribe = listenToNumbers(RAFFLE_ID, (data) => {
      setNumbersData(data);
    });
    return () => unsubscribe();
  }, []);

  const handleSelectNumber = (num) => {
    setSelectedNumbers(prev => {
      if (prev.includes(num)) return prev.filter(n => n !== num);
      return [...prev, num].sort((a, b) => a - b);
    });
  };

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
      const reserved = await reserveNumbers(RAFFLE_ID, selectedNumbers, { name, whatsapp });
      if (!reserved) {
        alert("Alguns números já foram escolhidos! Tente novamente.");
        setLoading(false);
        setIsModalOpen(false);
        return;
      }

      const data = await generatePix({
        customerName: name,
        customerPhone: whatsapp,
        numbers: selectedNumbers,
        value: totalValue,
        raffleId: RAFFLE_ID
      });

      if (data.success || data.pix) {
        setPixData(data);
      } else {
        alert("Erro ao gerar o Pix. Tente novamente.");
      }
    } catch (error) {
      alert("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    const payload = pixData?.payload || pixData?.pix?.qr_code;
    if (payload) {
      navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCancel = async () => {
    if (window.confirm("Deseja realmente cancelar a reserva e liberar seus números para outras pessoas?")) {
      await cancelReservation(RAFFLE_ID, selectedNumbers);
      setIsModalOpen(false);
      setPixData(null);
      setSelectedNumbers([]);
      setTimeLeft(300);
    }
  };

  const handleSecretAdmin = () => {
    const newCount = secretClicks + 1;
    setSecretClicks(newCount);
    if (newCount >= 3) {
      navigate('/admin');
      setSecretClicks(0);
    }
    setTimeout(() => setSecretClicks(0), 1500);
  };

  return (
    <div className="animate-fade-in w-full" style={{ paddingBottom: '40px' }}>
      <div style={heroStyle} className="animate-fade-in">
        <img 
          src="/banner.png" 
          alt="Urso Chá de Bebê" 
          className="animate-float"
          onClick={handleSecretAdmin}
          style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '50%', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', marginBottom: '16px', cursor: 'pointer' }} 
        />
        <h1 style={{ fontSize: '2.4rem', marginBottom: '8px', lineHeight: '1.1' }} className="text-gradient">
          Chá de Bebê
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '280px', margin: '0 auto 10px' }}>
          Escolha o seu ponto da sorte e participe!
        </p>
      </div>

      <div style={{ padding: '0 16px', marginTop: '5px' }}>
        <div className="glass" style={{ padding: '20px', background: 'var(--surface-solid)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--primary-dark)' }}>Números</h2>
            <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>R$ {PRECO.toFixed(2).replace('.',',')}</span>
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

      <BottomSheetModal isOpen={isModalOpen} onClose={() => { if(!loading) setIsModalOpen(false); }}>
        {!pixData ? (
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
            <button className="btn btn-primary" onClick={() => { setIsModalOpen(false); setPixData(null); setSelectedNumbers([]); }}>
              Concluir <Check size={20} />
            </button>
          </div>
        ) : (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--accent)' }}>
              <CheckCircle size={48} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '4px', color: 'var(--primary-dark)' }}>Quase Lá, {name.split(' ')[0]}!</h2>
            <div style={{ background: '#FFF0F2', padding: '6px 16px', borderRadius: '20px', display: 'inline-block', marginBottom: '20px' }}>
              <span style={{ color: '#FF6B81', fontWeight: 'bold' }}>
                Expira em: {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
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

            <button className="btn btn-secondary" onClick={handleCopyPix} style={{ marginBottom: '12px' }}>
              {copied ? <><Check size={20} /> Copiado!</> : <><Copy size={20} /> Copiar Chave Pix</>}
            </button>

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
    </div>
  );
};

const heroStyle = {
  width: '100%',
  padding: '40px 20px 20px',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

export default Home;
