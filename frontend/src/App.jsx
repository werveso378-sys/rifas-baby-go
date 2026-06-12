import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Home from './pages/Home';
import Admin from './pages/Admin';
import ClientArea from './pages/ClientArea';
import { Capacitor } from '@capacitor/core';
import { getAppVersion } from './services/firebaseService';
import UpdateModal from './components/UpdateModal';
import './index.css';

// Separate component to use hooks inside BrowserRouter
function AppInner() {
  const [isDark, setIsDark] = useState(false);
  const navigate = useNavigate();

  const LOCAL_VERSION = '1.0.0'; // Define a versão local do App
  const [updateData, setUpdateData] = useState(null);

  useEffect(() => {
    // Restore theme only
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setIsDark(true);
      document.body.classList.add('dark');
    }

    // Force Admin view on Native App
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

  const toggleTheme = () => {
    if (isDark) {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <>
      {updateData && Capacitor.isNativePlatform() && (
        <UpdateModal versionData={updateData} onClose={() => setUpdateData(null)} />
      )}
      <main style={{ paddingBottom: '100px', paddingTop: '20px' }}>
        <Routes>
          <Route path="/" element={
            localStorage.getItem('isAdminLoggedIn') === 'true'
              ? <Navigate to="/admin" replace />
              : <Home />
          } />
          <Route path="/meus-numeros" element={<ClientArea />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <HashRouter>
      <AppInner />
      <SpeedInsights />
    </HashRouter>
  );
}

export default App;
