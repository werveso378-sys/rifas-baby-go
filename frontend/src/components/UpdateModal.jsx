import React, { useState } from 'react';
import { Download, Rocket, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import UpdatePlugin from '../plugins/UpdatePlugin';

const UpdateModal = ({ versionData, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const { version, apkUrl, changelog, force } = versionData;

  const handleUpdate = async () => {
    setDownloading(true);
    try {
      await UpdatePlugin.downloadAndInstall({
        url: apkUrl,
        title: `Atualizando para v${version}`,
        description: 'Baixando nova versão do aplicativo...'
      });
      // Fechamos o modal após disparar o download nativo, a barra de notificação do Android cuida do resto
      if (!force) {
        onClose();
      }
    } catch (e) {
      console.error("Erro ao chamar UpdatePlugin:", e);
      alert('Erro ao tentar iniciar a atualização. Tente baixar o APK manualmente pelo site.');
      setDownloading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '20px'
    }}>
      <div className="animate-slide-up" style={{
        background: 'var(--surface)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '380px',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
      }}>
        {/* Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #007AFF 0%, #00C6FF 100%)',
          padding: '30px 20px',
          textAlign: 'center',
          color: '#FFF'
        }}>
          <Rocket size={48} style={{ marginBottom: '16px' }} className="animate-bounce" />
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 'bold' }}>Nova Versão!</h2>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '0.9rem' }}>A versão {version} já está disponível.</p>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>✨</span> Novidades:
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {changelog && changelog.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle size={18} color="#34C759" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{item}</span>
              </div>
            ))}
          </div>

          {force && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFF0F2', color: '#FF3B30', padding: '12px', borderRadius: '12px', marginBottom: '24px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              <AlertTriangle size={18} />
              <span>Esta atualização é obrigatória.</span>
            </div>
          )}

          <button 
            onClick={handleUpdate}
            disabled={downloading}
            style={{
              width: '100%', padding: '16px', borderRadius: '16px',
              background: downloading ? '#E5E5EA' : '#007AFF',
              color: downloading ? '#8E8E93' : '#FFF',
              border: 'none', fontSize: '1rem', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              cursor: downloading ? 'default' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {downloading ? 'Iniciando Download...' : (
              <>
                Atualizar Agora <Download size={20} />
              </>
            )}
          </button>
          
          {!force && !downloading && (
            <button 
              onClick={onClose}
              style={{
                width: '100%', padding: '16px', background: 'none',
                border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem',
                cursor: 'pointer', marginTop: '8px', fontWeight: 'bold'
              }}
            >
              Lembrar depois
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
