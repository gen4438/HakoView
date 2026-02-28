/**
 * TabBar コンポーネントのテスト（T024）
 * TDD: 先にテストを書き、FAILを確認してから実装
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TabBar } from '../../components/drawer/TabBar';
import type { TabId } from '../../store/controlTypes';

const tabs: { id: TabId; label: string }[] = [
  { id: 'display', label: '表示' },
  { id: 'camera', label: 'カメラ' },
  { id: 'colors', label: 'カラー' },
  { id: 'clipping', label: 'クリッピング' },
];

describe('TabBar', () => {
  it('4つのタブを表示する', () => {
    const onSelect = vi.fn();
    render(<TabBar tabs={tabs} activeTab="display" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: '表示' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'カメラ' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'カラー' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'クリッピング' })).toBeInTheDocument();
  });

  it('activeTab が選択状態（aria-selected）になる', () => {
    const onSelect = vi.fn();
    render(<TabBar tabs={tabs} activeTab="camera" onSelect={onSelect} />);
    const cameraTab = screen.getByRole('tab', { name: 'カメラ' });
    expect(cameraTab).toHaveAttribute('aria-selected', 'true');
    const displayTab = screen.getByRole('tab', { name: '表示' });
    expect(displayTab).toHaveAttribute('aria-selected', 'false');
  });

  it('タブをクリックすると onSelect が呼ばれる', () => {
    const onSelect = vi.fn();
    render(<TabBar tabs={tabs} activeTab="display" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('tab', { name: 'カラー' }));
    expect(onSelect).toHaveBeenCalledWith('colors');
  });

  it('tablist ロールを持つコンテナが存在する', () => {
    const onSelect = vi.fn();
    render(<TabBar tabs={tabs} activeTab="display" onSelect={onSelect} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });
});
