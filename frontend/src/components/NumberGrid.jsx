import React from 'react';
import './NumberGrid.css';

const NumberGrid = ({ totalNumbers = 100, numbersData, selectedNumbers, onSelectNumber }) => {
  return (
    <div className="animate-fade-in">
      <div className="number-grid">
        {Array.from({ length: totalNumbers }, (_, i) => {
          const num = i + 1;
          const data = numbersData.find(n => n.number === num);
          const status = data ? data.status : 'AVAILABLE';
          
          let statusClass = 'available';
          if (status === 'RESERVED' || status === 'PENDING_PAYMENT') statusClass = 'reserved';
          if (status === 'PAID') statusClass = 'paid';
          
          const isSelected = selectedNumbers.includes(num);

          return (
            <div 
              key={num}
              onClick={() => {
                if (status === 'AVAILABLE' || status === 'CANCELED') {
                  onSelectNumber(num);
                }
              }}
              className={`number-cell ${statusClass} ${isSelected ? 'selected' : ''}`}
              title={data?.ownerName ? `Comprado por: ${data.ownerName}` : `Número ${num}`}
            >
              {String(num).padStart(2, '0')}
            </div>
          );
        })}
      </div>
      
      <div className="legend">
        <div className="legend-item"><div className="legend-color legend-available"></div> Livres</div>
        <div className="legend-item"><div className="legend-color legend-selected"></div> Selecionado</div>
        <div className="legend-item"><div className="legend-color legend-reserved"></div> Reservado</div>
        <div className="legend-item"><div className="legend-color legend-paid"></div> Pago</div>
      </div>
    </div>
  );
};

export default NumberGrid;
