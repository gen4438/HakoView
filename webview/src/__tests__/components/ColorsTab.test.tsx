/**
 * ColorsTab コンポーネントのテスト（T039）
 * TDD: 先にテストを書き、FAILを確認してから実装
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColorsTab } from '../../components/tabs/ColorsTab';
import { useControlStore } from '../../store/controlStore';
import { DEFAULT_CONTROL_STATE } from '../../store/controlDefaults';

describe('ColorsTab', () => {
  beforeEach(() => {
    useControlStore.setState({ ...DEFAULT_CONTROL_STATE });
  });

  it('16個のカラーコントロールが表示される', () => {
    render(<ColorsTab />);
    // aria-label またはラベルに color0〜color15 または カラーラベルが含まれる
    const colorInputs = screen.getAllByDisplayValue(/^#/);
    expect(colorInputs.length).toBe(16);
  });

  it('可視性チェックボックスが16個存在する', () => {
    render(<ColorsTab />);
    // ToggleControl または input[type="checkbox"] が16個
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(16);
  });

  it('カラー変更がストアに反映される', () => {
    render(<ColorsTab />);
    const colorInputs = screen.getAllByDisplayValue(/^#/);
    // 最初のカラー（インデックス0）を変更
    fireEvent.input(colorInputs[0], { target: { value: '#ff0000' } });
    expect(useControlStore.getState().customColors[0]).toBe('#ff0000');
  });

  it('index 0 の可視性はデフォルトで false（チェックなし）', () => {
    render(<ColorsTab />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('アクションボタンが3つ表示される（コピー、保存、設定を開く）', () => {
    render(<ColorsTab />);
    expect(screen.getByRole('button', { name: /コピー/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Custom カラーマップとして保存/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /設定を開く/ })).toBeInTheDocument();
  });
});
