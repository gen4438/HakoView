import React from 'react';
import './controls.css';

export type SelectOption = string | { value: string; label: string };

export interface SelectControlProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

/** `SelectOption` から value 文字列を取得 */
const optionValue = (opt: SelectOption): string => (typeof opt === 'string' ? opt : opt.value);

/** `SelectOption` から表示ラベルを取得 */
const optionLabel = (opt: SelectOption): string => (typeof opt === 'string' ? opt : opt.label);

export const SelectControl: React.FC<SelectControlProps> = ({
  label,
  value,
  options,
  onChange,
}) => {
  return (
    <div className="control-row">
      <label className="control-label">{label}</label>
      <div className="control-input select-input">
        <select value={value} onChange={(e) => onChange(e.target.value)} tabIndex={0}>
          {options.map((opt) => (
            <option key={optionValue(opt)} value={optionValue(opt)}>
              {optionLabel(opt)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
