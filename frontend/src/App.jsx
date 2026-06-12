import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import ClientArea from './pages/ClientArea';
import { Capacitor } from '@capacitor/core';
import { getAppVersion } from './services/firebaseService';
import UpdateModal from './components/UpdateModal';
import './index.css';

// Componente para capturar erros e evitar tela branca
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Erro capturado no React:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', background: '#fff', minHeight: '100vh' }}>
          <h2>Erro Fatal no App</h2>
          <p>{this.state.error?.toString()}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Separate component to use hooks inside BrowserRouter
function AppInner() {
  const [isDark, setIsDark] = useState(false);
  const navigate = useNavigate();

  const LOCAL_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'; // Lida da configuração do Vite
  const [updateData, setUpdateData] = useState(null);

  useEffect(() => {
    // Restore theme only
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setIsDark(true);
      document.body.classList.add('dark');
    }

    // Force Admin view on Native App ( handled in Routes now, but keep this just in case )
    if (Capacitor.isNativePlatform()) {
      navigate('/admin', { replace: true });
    }

    // Check for Updates
    const checkUpdate = async () => {
      const data = await getAppVersion();
      if (data && data.version && data.version > LOCAL_VERSION) {
        setUpdateData(data);
      }
    };
    checkUpdate();
  }, [navigate]);



  return (
    <>
      {updateData && Capacitor.isNativePlatform() && (
        <UpdateModal versionData={updateData} onClose={() => setUpdateData(null)} />
      )}
      <main style={{ paddingBottom: '100px', paddingTop: '20px' }}>
        <Routes>
          {Capacitor.isNativePlatform() ? (
            <Route path="*" element={<Admin />} />
          ) : (
            <>
              <Route path="/" element={
                localStorage.getItem('isAdminLoggedIn') === 'true'
                  ? <Navigate to="/admin" replace />
                  : <Home />
              } />
              <Route path="/meus-numeros" element={<ClientArea />} />
              <Route path="/admin" element={<Admin />} />
            </>
          )}
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppInner />
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
