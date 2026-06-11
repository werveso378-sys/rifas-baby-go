import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <main style={{ paddingBottom: '100px', paddingTop: '20px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
