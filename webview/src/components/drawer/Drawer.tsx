import React, { useState } from 'react';
import { TabBar } from './TabBar';
import type { TabId } from '../../store/controlTypes';
import { DisplayTab } from '../tabs/DisplayTab';
import { CameraTab } from '../tabs/CameraTab';
import { ColorsTab } from '../tabs/ColorsTab';
import { ClippingTab } from '../tabs/ClippingTab';
import './Drawer.css';

export interface DrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  /** 色設定をVSCode設定に保存（ColorsTab に転送） */
  onSaveColorSettings?: (colormap: Record<string, string>) => void;
  /** VSCode設定パネルを開く（ColorsTab に転送） */
  onOpenSettings?: () => void;
}

/** タブの定義 */
const TABS: { id: TabId; label: string }[] = [
  { id: 'display', label: '表示' },
  { id: 'camera', label: 'カメラ' },
  { id: 'colors', label: 'カラー' },
  { id: 'clipping', label: 'クリッピング' },
];

interface TabContentProps {
  activeTab: TabId;
  onSaveColorSettings?: (colormap: Record<string, string>) => void;
  onOpenSettings?: () => void;
}

/** タブコンテンツレンダラ（display:none 方式でタブを切り替え、状態を保持） */
const TabContent: React.FC<TabContentProps> = ({
  activeTab,
  onSaveColorSettings,
  onOpenSettings,
}) => {
  return (
    <>
      {/* display:none 方式で全タブをマウントし状態を保持（FR-007, FR-008 準拠） */}
      <div style={{ display: activeTab === 'display' ? 'block' : 'none' }}>
        <DisplayTab />
      </div>
      <div style={{ display: activeTab === 'camera' ? 'block' : 'none' }}>
        <CameraTab />
      </div>
      <div style={{ display: activeTab === 'colors' ? 'block' : 'none' }}>
        <ColorsTab onSaveColorSettings={onSaveColorSettings} onOpenSettings={onOpenSettings} />
      </div>
      <div style={{ display: activeTab === 'clipping' ? 'block' : 'none' }}>
        <ClippingTab />
      </div>
    </>
  );
};

/** 画面右側のスライドインドロワーコンテナ。
 *
 * - `isOpen` が true のとき右側からスライドインする。
 * - `onToggle` でトグルボタンのクリックを親に通知する。
 * - 子要素を渡した場合はそちらを優先表示、なければ TabBar+タブコンテンツを表示。
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onToggle,
  children,
  onSaveColorSettings,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('display');

  return (
    <>
      {/* トグルボタン（ドロワーの外側、常に表示） */}
      <button
        className={`drawer-toggle-btn ${isOpen ? 'drawer-toggle-btn--open' : ''}`}
        onClick={onToggle}
        aria-label="Controls"
        aria-expanded={isOpen}
        title={isOpen ? 'コントロールを閉じる' : 'コントロールを開く'}
      >
        <span className="drawer-toggle-icon">{isOpen ? '›' : '‹'}</span>
      </button>

      {/* ドロワー本体 */}
      <aside
        role="complementary"
        className={`drawer ${isOpen ? 'drawer--open' : 'drawer--closed'}`}
        aria-hidden={!isOpen}
      >
        {children ? (
          <div className="drawer-content">{children}</div>
        ) : (
          <>
            <TabBar tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />
            <div className="drawer-content">
              <TabContent
                activeTab={activeTab}
                onSaveColorSettings={onSaveColorSettings}
                onOpenSettings={onOpenSettings}
              />
            </div>
          </>
        )}
      </aside>
    </>
  );
};
