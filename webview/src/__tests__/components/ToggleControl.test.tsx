import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ToggleControl } from '../../components/controls/ToggleControl';

describe('ToggleControl', () => {
  const defaultProps = {
    label: 'Perspective',
    checked: true,
    onChange: vi.fn(),
  };

  it('ラベルが表示される', () => {
    render(<ToggleControl {...defaultProps} />);
    expect(screen.getByText('Perspective')).toBeInTheDocument();
  });

  it('checked=true の場合にチェック状態が反映される', () => {
    render(<ToggleControl {...defaultProps} checked={true} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('checked=false の場合にチェック状態が反映される', () => {
    render(<ToggleControl {...defaultProps} checked={false} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('クリックで onChange が発火する（true → false）', () => {
    const onChange = vi.fn();
    render(<ToggleControl {...defaultProps} checked={true} onChange={onChange} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('クリックで onChange が発火する（false → true）', () => {
    const onChange = vi.fn();
    render(<ToggleControl {...defaultProps} checked={false} onChange={onChange} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Space キーで onChange が発火する', () => {
    const onChange = vi.fn();
    render(<ToggleControl {...defaultProps} checked={false} onChange={onChange} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.keyDown(checkbox, { key: ' ', code: 'Space' });
    expect(onChange).toHaveBeenCalled();
  });
});
