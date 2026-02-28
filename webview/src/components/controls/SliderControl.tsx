import React from 'react';
import './controls.css';

export interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}) => {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const handleRangeInput = (e: React.FormEvent<HTMLInputElement>) => {
    onChange(parseFloat((e.target as HTMLInputElement).value));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    }
  };

  return (
    <div className="control-row">
      <label className="control-label">{label}</label>
      <div className="control-input slider-input">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={handleRangeInput}
          onChange={() => {
            /* handled by onInput */
          }}
          tabIndex={0}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleNumberChange}
          tabIndex={0}
        />
      </div>
    </div>
  );
};
