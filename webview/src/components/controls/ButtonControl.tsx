import React from 'react';
import './controls.css';

export interface ButtonControlProps {
  label: string;
  onClick: () => void;
}

export const ButtonControl: React.FC<ButtonControlProps> = ({ label, onClick }) => {
  return (
    <div className="control-row button-row">
      <button className="control-button" onClick={onClick} tabIndex={0}>
        {label}
      </button>
    </div>
  );
};
