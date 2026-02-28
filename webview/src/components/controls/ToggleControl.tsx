import React from 'react';
import './controls.css';

export interface ToggleControlProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const ToggleControl: React.FC<ToggleControlProps> = ({ label, checked, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div className="control-row">
      <label className="control-label">{label}</label>
      <div className="control-input toggle-input">
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          />
          <span className="toggle-slider" />
        </label>
      </div>
    </div>
  );
};
