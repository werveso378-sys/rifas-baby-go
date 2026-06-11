import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, User, CheckCircle, Clock } from 'lucide-react';
import { getClientPassword, setClientPassword, getClientNumbers } from '../services/firebaseService';

const RAFFLE_ID = "baby_shower_01";
const PRECO = 0.01;

const ClientArea = () => {
  const navigate = useNavigate();
  const [whatsapp, setWhatsapp] = useState(localStorage.getItem('clientWhatsapp') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(localStorage.getItem('clientName') || '');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [numbers, setNumbers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // Auto-login if we already have a session
    const sessionPhone = localStorage.getItem('clientSessionPhone');
    if (sessionPhone) {
      setWhatsapp(sessionPhone);
      setLoggedIn(true);
      fetchNumbers(sessionPhone);
    }
  }, []);

  const formatPhone = (v) => {
    v = v.replace(/\D/g, '');
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
    if (v.length > 9) v = `${v.substring(0, 9)}-${v.substring(9)}`;
    return v;
  };

  const handlePhoneChange = async (e) => {
    const formatted = formatPhone(e.target.value);
    setWhatsapp(formatted);
    setError('');
    
    // Check if user exists when phone is fully typed
    if (formatted.replace(/\D/g, '').length >= 10) {
      const existingPass = await getClientPassword(formatted);
      if (existingPass) {
        setIsRegistering(false);
      } else {
        setIsRegistering(true);
      }
    }
  };

  const handleLoginOrRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (whatsapp.replace(/\D/g, '').length < 10) {
      setError('Telefone inválido.');
      setLoading(false);
      return;
    }
    if (password.length < 4) {
      setError('A senha deve ter no mínimo 4 caracteres.');
      setLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        if (!name) {
          setError('Preencha seu nome para criar a senha.');
          setLoading(false);
          return;
        }
        await setClientPassword(whatsapp, name, password);
        finishLogin(whatsapp, name);
      } else {
        const existingPass = await getClientPassword(whatsapp);
        if (existingPass === password) {
          finishLogin(whatsapp, name);
        } else {
          setError('Senha incorreta.');
        }
      }
    } catch (err) {
      setError('Erro ao processar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const finishLogin = (phone, n) => {
    localStorage.setItem('clientSessionPhone', phone);
    if (n) localStorage.setItem('clientName', n);
    setLoggedIn(true);
    fetchNumbers(phone);
  };

  const handleLogout = () => {
    localStorage.removeItem('clientSessionPhone');
    setLoggedIn(false);
    setNumbers([]);
    setPassword('');
  };

  const fetchNumbers = async (phone) => {
    setLoading(true);
    const nums = await getClientNumbers(RAFFLE_ID, phone);
    setNumbers(nums);
    setLoading(false);
  };

  const handleSendReceipt = (reservation) => {
    const valor = (reservation.numbers.length * PRECO).toFixed(2).replace('.', ',');
    const nums = reservation.numbers.sort((a, b) => a - b).join(', ');
    const dataAtual = new Date().toLocaleString('pt-BR');
    
    const lines = [
      '✅ *Comprovante de Reserva - Rifa Baby*',
      '',
      `👤 *Nome:* ${reservation.name}`,
      `🎫 *Números Pagos:* ${nums}`,
      `💰 *Valor Total:* R$ ${valor}`,
      `📅 *Data:* ${dataAtual}`,
      '',
      'Acesse seus números no link: https://rifas-baby-go.vercel.app/meus-numeros'
    ];
    
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  if (loggedIn) {
    // Group numbers if needed, but here we can just show them all in one block
    const paidNumbers = numbers.filter(n => n.status === 'PAID');
    const pendingNumbers = numbers.filter(n => n.status === 'PENDING_PAYMENT');

    return (
      <div className="w-full animate-fade-in" style={{ padding: '0 12px 80px', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ maxWidth: '400px', width: '100%', paddingTop: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}>
              <ArrowLeft size={24} /> Voltar
            </button>
            <button onClick={handleLogout} style={{ background: '#FFF0F2', color: '#FF3B30', border: 'none', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
              Sair
            </button>
          </div>

          <h2 style={{ fontSize: '1.5rem', color: 'var(--primary-dark)', marginBottom: '8px' }}>Meus Números</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>Aqui estão todas as suas reservas.</p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Carregando...</div>
          ) : numbers.length === 0 ? (
            <div style={{ background: 'var(--surface-solid)', padding: '30px 20px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <p style={{ color: 'var(--text-muted)' }}>Você ainda não tem números reservados.</p>
              <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => navigate('/')}>Comprar Números</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {paidNumbers.length > 0 && (
                <div style={{ background: 'var(--surface-solid)', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid rgba(52,199,89,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#34C759', fontWeight: 'bold' }}>
                    <CheckCircle size={20} /> Pagamento Aprovado
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{paidNumbers.length} número(s) garantidos</p>
                  <p style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--primary-dark)', fontWeight: 'bold', wordBreak: 'break-word' }}>
                    {paidNumbers.map(n => n.number).sort((a,b)=>a-b).join(', ')}
                  </p>
                  <button 
                    onClick={() => handleSendReceipt({ name: paidNumbers[0].ownerName, numbers: paidNumbers.map(n=>n.number) })}
                    style={{ width: '100%', background: '#25D366', color: '#fff', border: 'none', padding: '10px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Enviar Comprovante
                  </button>
                </div>
              )}

              {pendingNumbers.length > 0 && (
                <div style={{ background: 'var(--surface-solid)', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid rgba(255,149,0,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#FF9500', fontWeight: 'bold' }}>
                    <Clock size={20} /> Aguardando Pagamento
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{pendingNumbers.length} número(s) reservados</p>
                  <p style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--primary-dark)', fontWeight: 'bold', wordBreak: 'break-word' }}>
                    {pendingNumbers.map(n => n.number).sort((a,b)=>a-b).join(', ')}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0' }}>Acesse a página inicial e refaça a reserva caso tenha expirado.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Login / Register Screen
  return (
    <div className="w-full animate-fade-in" style={{ padding: '0 12px', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '360px', width: '100%', background: 'var(--surface-solid)', padding: '24px', borderRadius: '24px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
        
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
          <ArrowLeft size={18} /> Voltar
        </button>

        <h2 style={{ fontSize: '1.6rem', color: 'var(--primary-dark)', marginBottom: '8px', textAlign: 'center' }}>Meus Números</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', textAlign: 'center' }}>
          {isRegistering ? 'Crie uma senha para proteger seus números.' : 'Digite sua senha para acessar seus números.'}
        </p>

        <form onSubmit={handleLoginOrRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px' }}>WhatsApp</label>
            <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={18} color="#999" />
              <input 
                type="tel" 
                placeholder="(00) 00000-0000"
                value={whatsapp} 
                onChange={handlePhoneChange}
                style={{ border: 'none', background: 'none', width: '100%', outline: 'none' }}
                required
              />
            </div>
          </div>

          {isRegistering && (
            <div className="animate-fade-in">
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px' }}>Seu Nome</label>
              <input 
                className="input-field"
                type="text" 
                placeholder="Como gosta de ser chamado"
                value={name} 
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="animate-fade-in">
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px' }}>Senha</label>
            <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Lock size={18} color="#999" />
              <input 
                type="password" 
                placeholder={isRegistering ? "Crie uma senha fácil" : "Digite sua senha"}
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                style={{ border: 'none', background: 'none', width: '100%', outline: 'none' }}
                required
              />
            </div>
          </div>

          {error && <div style={{ color: '#FF3B30', fontSize: '0.85rem', textAlign: 'center', marginTop: '-4px' }}>{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={loading}>
            {loading ? 'Aguarde...' : isRegistering ? 'Criar Senha e Entrar' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ClientArea;
