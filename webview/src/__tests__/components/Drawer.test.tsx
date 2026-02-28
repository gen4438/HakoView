import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Drawer } from '../../components/drawer/Drawer';

describe('Drawer', () => {
  const defaultProps = {
    isOpen: false,
    onToggle: vi.fn(),
  };

  it('閉じた状態ではドロワー本体が非表示クラスを持つ', () => {
    render(<Drawer {...defaultProps} isOpen={false} />);
    // aria-hidden=true のためhidden:trueオプションが必要
    const drawer = screen.getByRole('complementary', { hidden: true });
    expect(drawer).toHaveClass('drawer--closed');
  });

  it('開いた状態ではドロワー本体が開くクラスを持つ', () => {
    render(<Drawer {...defaultProps} isOpen={true} />);
    const drawer = screen.getByRole('complementary');
    expect(drawer).toHaveClass('drawer--open');
  });

  it('トグルボタンが存在する', () => {
    render(<Drawer {...defaultProps} />);
    const button = screen.getByRole('button', { name: /Controls|コントロール/i });
    expect(button).toBeInTheDocument();
  });

  it('トグルボタンクリックで onToggle が呼ばれる', () => {
    const onToggle = vi.fn();
    render(<Drawer {...defaultProps} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: /Controls|コントロール/i });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('子要素が渡された場合に表示される', () => {
    render(
      <Drawer {...defaultProps} isOpen={true}>
        <div data-testid="child-content">Child Content</div>
      </Drawer>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});
