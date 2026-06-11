import React, { useState, useEffect } from 'react';
import { listenToNumbers, reserveNumbers } from '../services/firebaseService';
import { generatePix } from '../services/paymentService';
import NumberGrid from '../components/NumberGrid';
import BottomSheetModal from '../components/BottomSheetModal';
import { Copy, QrCode, CheckCircle, ChevronRight, Check } from 'lucide-react';

const PRECO = 0.01;
const RAFFLE_ID = "baby_shower_01";

const Home = () => {
  const [numbersData, setNumbersData] = useState([]);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  
  // Checkout State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [pixData, setPixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const handleGeneratePix = async () => {
    if (!name.trim() || !whatsapp.trim()) {
      alert("Por favor, preencha seu nome e WhatsApp.");
      return;
    }

    setLoading(true);
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

  return (
    <div className="animate-fade-in w-full">
      {/* Banner Header */}
      <div style={headerStyle}>
        <img src="/banner.png" alt="Chá de Bebê" style={bannerImgStyle} />
        <div style={headerContentStyle} className="glass">
          <h1 style={{ fontSize: '1.8rem', marginBottom: '4px' }}>Chá de Bebê 🧸</h1>
          <p style={{ color: 'var(--text-muted)' }}>Escolha seus números da sorte!</p>
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: '20px' }}>
        <div className="glass" style={{ padding: '20px', background: '#fff' }}>
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
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      {selectedNumbers.length > 0 && (
        <div className="animate-slide-up" style={stickyBarStyle}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
              {selectedNumbers.length} número(s) selecionado(s)
            </p>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--primary-dark)' }}>
              R$ {totalValue.toFixed(2).replace('.', ',')}
            </h3>
          </div>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '14px 24px' }} onClick={() => setIsModalOpen(true)}>
            Continuar <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Checkout Modal (Bottom Sheet) */}
      <BottomSheetModal isOpen={isModalOpen} onClose={() => { if(!loading) setIsModalOpen(false); }}>
        {!pixData ? (
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
                className="input-field" 
                placeholder="Seu WhatsApp" 
                type="tel"
                value={whatsapp} 
                onChange={e => setWhatsapp(e.target.value)} 
              />
            </div>

            <button 
              className="btn btn-primary" 
              onClick={handleGeneratePix}
              disabled={loading || !name || !whatsapp}
            >
              {loading ? 'Processando...' : <><QrCode size={20} /> Gerar Pix de R$ {totalValue.toFixed(2).replace('.', ',')}</>}
            </button>
          </div>
        ) : (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--accent)' }}>
              <CheckCircle size={48} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--primary-dark)' }}>Quase Lá, {name.split(' ')[0]}!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Copie a chave abaixo ou escaneie o QR Code.</p>
            
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

            <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '16px' }}>
              Seus números ({selectedNumbers.join(', ')}) ficarão reservados aguardando o pagamento.
            </p>
          </div>
        )}
      </BottomSheetModal>
    </div>
  );
};

const headerStyle = {
  position: 'relative',
  width: '100%',
  height: '240px',
  marginBottom: '40px'
};

const bannerImgStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderBottomLeftRadius: '32px',
  borderBottomRightRadius: '32px',
  boxShadow: 'var(--shadow-soft)'
};

const headerContentStyle = {
  position: 'absolute',
  bottom: '-25px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '85%',
  padding: '16px',
  textAlign: 'center',
  background: '#fff'
};

const stickyBarStyle = {
  position: 'fixed',
  bottom: '85px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'calc(100% - 32px)',
  maxWidth: '468px',
  background: 'var(--surface-solid)',
  padding: '16px 20px',
  borderRadius: '24px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  zIndex: 90
};

export default Home;
