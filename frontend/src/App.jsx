import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      {/* Navbar Minimalista */}
      <nav style={navStyle} className="glass">
        <Link to="/" style={linkStyle}>Rifa</Link>
        <Link to="/admin" style={linkStyle}>Painel</Link>
      </nav>
      
      <main style={{ paddingBottom: '100px', paddingTop: '20px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

const navStyle = {
  position: 'fixed',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 100,
  display: 'flex',
  gap: '20px',
  padding: '12px 30px',
  borderRadius: '50px',
};

const linkStyle = {
  color: 'var(--primary-dark)',
  textDecoration: 'none',
  fontWeight: '600',
  fontSize: '15px'
};

export default App;
