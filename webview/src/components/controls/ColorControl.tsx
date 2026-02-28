import React from 'react';
import './controls.css';

export interface ColorControlProps {
  label: string;
  value: string; // hex color e.g. '#ff0000'
  onChange: (color: string) => void;
  showVisibility?: boolean;
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
}

export const ColorControl: React.FC<ColorControlProps> = ({
  label,
  value,
  onChange,
  showVisibility = false,
  visible = true,
  onVisibilityChange,
}) => {
  return (
    <div className="color-cell">
      {showVisibility && (
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => onVisibilityChange?.(e.target.checked)}
          tabIndex={0}
          className="color-visibility-checkbox"
          aria-label={`${label} visibility`}
        />
      )}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={0}
        className="color-picker"
      />
      <span className="color-id-label">{label}</span>
    </div>
  );
};
