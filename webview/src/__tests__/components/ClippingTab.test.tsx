/**
 * ClippingTab コンポーネントのテスト
 * T043 [US5] FR-018 準拠
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ClippingTab } from '../../components/tabs/ClippingTab';
import { useControlStore } from '../../store/controlStore';

beforeEach(() => {
  useControlStore.setState({
    clippingMode: 'Off',
    sliceAxis: 'Z',
    slicePosition1Z: 0,
    slicePosition2Z: 100,
    customNormalX: 0,
    customNormalY: 0,
    customNormalZ: 1,
    customDistance: 0,
  });
});

describe('ClippingTab', () => {
  it('クリッピングモードのセレクトが表示される', () => {
    render(<ClippingTab />);
    // モードセレクトの存在確認
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(1);
  });

  it('Off モードではスライス軸とポジションが非表示', () => {
    render(<ClippingTab />);
    // Off モードではスライス軸セレクトが表示されない
    const labels = screen.queryByText('スライス軸');
    expect(labels).toBeNull();
  });

  it('Slice モードに切り替えると、スライス軸・スライスポジションが表示される', () => {
    render(<ClippingTab />);
    // clippingMode セレクトを Slice に変更
    const modeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(modeSelect, { target: { value: 'Slice' } });

    // スライス軸セレクト表示
    expect(screen.getByText('スライス軸')).toBeInTheDocument();
    // スライスポジションスライダー表示
    expect(screen.getByText('スライス位置（開始）')).toBeInTheDocument();
  });

  it('Custom モードに切り替えると、法線ベクトルと距離が表示される', () => {
    render(<ClippingTab />);
    const modeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(modeSelect, { target: { value: 'Custom' } });

    // カスタムパラメータ表示
    expect(screen.getByText(/法線 X/)).toBeInTheDocument();
    expect(screen.getByText(/距離/)).toBeInTheDocument();
  });

  it('スライス軸を変更するとストアに反映される', () => {
    useControlStore.setState({ clippingMode: 'Slice', sliceAxis: 'Z' });
    render(<ClippingTab />);
    const selects = screen.getAllByRole('combobox');
    // 2番目のセレクトがスライス軸
    const axisSelect = selects[1];
    fireEvent.change(axisSelect, { target: { value: 'X' } });
    expect(useControlStore.getState().sliceAxis).toBe('X');
  });
});
