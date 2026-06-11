import React from 'react';

const BottomSheetModal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={onClose} className="animate-fade-in">
      <div 
        style={sheetStyle} 
        onClick={(e) => e.stopPropagation()} 
        className="animate-slide-up glass"
      >
        <div style={dragHandleStyle}></div>
        {children}
      </div>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(33, 42, 62, 0.4)', // backdrop escuro
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
};

const sheetStyle = {
  background: 'var(--surface-solid)',
  width: '100%',
  maxWidth: '500px',
  margin: '0 auto',
  borderTopLeftRadius: '32px',
  borderTopRightRadius: '32px',
  padding: '24px 24px 40px',
  boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
  position: 'relative',
  maxHeight: '85vh',
  overflowY: 'auto',
};

const dragHandleStyle = {
  width: '40px',
  height: '5px',
  backgroundColor: 'var(--primary)',
  opacity: 0.3,
  borderRadius: '10px',
  margin: '0 auto 20px',
};

export default BottomSheetModal;
