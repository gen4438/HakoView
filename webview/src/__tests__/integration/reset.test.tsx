/**
 * リセット機能の統合テスト
 * T047 [US6] FR-019 準拠
 *
 * 複数の設定を変更した後、reset() で全フィールドがデフォルト値に戻ることを検証する
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { useControlStore } from '../../store/controlStore';
import { DEFAULT_CONTROL_STATE } from '../../store/controlDefaults';
import { DisplayTab } from '../../components/tabs/DisplayTab';

beforeEach(() => {
  useControlStore.getState().reset();
});

describe('リセット機能 (T047)', () => {
  it('複数の値を変更した後、reset() で全フィールドがデフォルト値に戻る', () => {
    // 複数のフィールドを変更
    useControlStore.setState({
      alpha: 0.5,
      dpr: 1,
      useOccupancy: false,
      showBoundingBox: true,
      clippingMode: 'Slice',
      sliceAxis: 'X',
    });

    // reset を呼び出す
    useControlStore.getState().reset();

    const state = useControlStore.getState();
    expect(state.alpha).toBe(DEFAULT_CONTROL_STATE.alpha);
    expect(state.dpr).toBe(DEFAULT_CONTROL_STATE.dpr);
    expect(state.useOccupancy).toBe(DEFAULT_CONTROL_STATE.useOccupancy);
    expect(state.showBoundingBox).toBe(DEFAULT_CONTROL_STATE.showBoundingBox);
    expect(state.clippingMode).toBe(DEFAULT_CONTROL_STATE.clippingMode);
    expect(state.sliceAxis).toBe(DEFAULT_CONTROL_STATE.sliceAxis);
  });

  it('reset() 後もカラー配列の長さが保持される', () => {
    // カラーを変更
    useControlStore.getState().updateColor(0, '#ff0000');
    useControlStore.getState().reset();

    const state = useControlStore.getState();
    expect(state.customColors).toHaveLength(16);
    expect(state.valueVisibility).toHaveLength(16);
  });

  it('reset() 後にアクションが正常に動作する', () => {
    // アルファを変更してリセット
    useControlStore.setState({ alpha: 0.3 });
    useControlStore.getState().reset();

    // リセット後も通常の操作ができる
    useControlStore.setState({ alpha: 0.7 });
    expect(useControlStore.getState().alpha).toBe(0.7);
  });

  it('DisplayTab にリセットボタンが存在する', () => {
    render(<DisplayTab />);
    const resetBtn = screen.queryByText(/リセット/);
    expect(resetBtn).not.toBeNull();
  });
});
