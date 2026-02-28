/**
 * TabBar コンポーネント（T026）
 * 4タブ（display, camera, colors, clipping）の切り替えUI。
 * component-api.md の TabBarProps に準拠。
 */
import React from 'react';
import type { TabId } from '../../store/controlTypes';
import './TabBar.css';

export interface TabBarProps {
  /** 表示するタブ一覧 */
  tabs: { id: TabId; label: string }[];
  /** 現在選択中のタブ ID */
  activeTab: TabId;
  /** タブ選択コールバック */
  onSelect: (id: TabId) => void;
}

/** ドロワー上部のタブバー。FR-005 に準拠。 */
export const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onSelect }) => {
  return (
    <div className="tabbar" role="tablist" aria-label="設定カテゴリ">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            className={`tabbar-tab${isActive ? ' tabbar-tab--active' : ''}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
