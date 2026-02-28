import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SliderControl } from '../../components/controls/SliderControl';

describe('SliderControl', () => {
  const defaultProps = {
    label: 'Alpha',
    value: 0.75,
    min: 0,
    max: 1,
    step: 0.01,
    onChange: vi.fn(),
  };

  it('ラベルが表示される', () => {
    render(<SliderControl {...defaultProps} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('range input が正しい属性で描画される', () => {
    render(<SliderControl {...defaultProps} />);
    const rangeInput = screen.getByRole('slider');
    expect(rangeInput).toHaveAttribute('type', 'range');
    expect(rangeInput).toHaveAttribute('min', '0');
    expect(rangeInput).toHaveAttribute('max', '1');
    expect(rangeInput).toHaveAttribute('step', '0.01');
    expect(rangeInput).toHaveValue('0.75');
  });

  it('number input が表示される', () => {
    render(<SliderControl {...defaultProps} />);
    const numberInput = screen.getByRole('spinbutton');
    expect(numberInput).toHaveAttribute('type', 'number');
    expect(numberInput).toHaveValue(0.75);
  });

  it('スライダー操作で onChange が発火する', () => {
    const onChange = vi.fn();
    render(<SliderControl {...defaultProps} onChange={onChange} />);
    const rangeInput = screen.getByRole('slider');
    fireEvent.input(rangeInput, { target: { value: '0.5' } });
    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it('数値入力で onChange が発火する', () => {
    const onChange = vi.fn();
    render(<SliderControl {...defaultProps} onChange={onChange} />);
    const numberInput = screen.getByRole('spinbutton');
    fireEvent.change(numberInput, { target: { value: '0.3' } });
    expect(onChange).toHaveBeenCalledWith(0.3);
  });

  it('min/max を超える値は範囲内にクランプされる', () => {
    const onChange = vi.fn();
    render(<SliderControl {...defaultProps} onChange={onChange} />);
    const numberInput = screen.getByRole('spinbutton');
    fireEvent.change(numberInput, { target: { value: '99' } });
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
