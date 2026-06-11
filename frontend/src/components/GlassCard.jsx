import React from 'react';

const GlassCard = ({ children, className = '' }) => {
  return (
    <div className={`glass p-6 ${className}`}>
      {children}
    </div>
  );
};

export default GlassCard;
