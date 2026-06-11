import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import Home from './pages/Home';
import Admin from './pages/Admin';
import ClientArea from './pages/ClientArea';
import { Capacitor } from '@capacitor/core';
import './index.css';

// Separate component to use hooks inside BrowserRouter
function AppInner() {
  const [isDark, setIsDark] = useState(false);
  const navigate = useNavigate();

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
      {/* Theme Toggle Button — floating bottom right */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '50%', width: '48px', height: '48px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: 'var(--shadow-soft)', backdropFilter: 'blur(10px)'
        }}
      >
        {isDark
          ? <Moon size={24} className="animate-spin-slower" color="#5AC8FA" />
          : <Sun size={24} className="animate-spin-slow" color="#FF9500" />
        }
      </button>

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
    </HashRouter>
  );
}

export default App;
