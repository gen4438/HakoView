/**
 * Accordion コンポーネント（T028）
 * 折りたたみセクション。component-api.md の AccordionProps に準拠。
 * FR-006, FR-008 準拠: 展開/折りたたみ状態をアンマウント後も保持。
 */
import React, { useState } from 'react';
import './Accordion.css';

export interface AccordionProps {
  /** セクションのラベル（ヘッダーに表示） */
  label: string;
  /** 初期展開状態（デフォルト: true） */
  defaultOpen?: boolean;
  children?: React.ReactNode;
}

/** 展開/折りたたみ可能なアコーディオンセクション。 */
export const Accordion: React.FC<AccordionProps> = ({ label, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="accordion">
      <button
        className={`accordion-header${isOpen ? ' accordion-header--open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        type="button"
      >
        <span className="accordion-icon">{isOpen ? '▼' : '▶'}</span>
        <span className="accordion-label">{label}</span>
      </button>
      <div
        className={`accordion-body${isOpen ? ' accordion-body--open' : ''}`}
        aria-hidden={!isOpen}
      >
        {children}
      </div>
    </div>
  );
};
