/**
 * Accordion コンポーネントのテスト（T025）
 * TDD: 先にテストを書き、FAILを確認してから実装
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Accordion } from '../../components/drawer/Accordion';

describe('Accordion', () => {
  it('ヘッダーラベルが表示される', () => {
    render(
      <Accordion label="Edge Highlight">
        <div>子コンテンツ</div>
      </Accordion>
    );
    expect(screen.getByText('Edge Highlight')).toBeInTheDocument();
  });

  it('デフォルトで展開状態（子コンテンツが表示）', () => {
    render(
      <Accordion label="My Section">
        <div>子コンテンツ</div>
      </Accordion>
    );
    expect(screen.getByText('子コンテンツ')).toBeInTheDocument();
  });

  it('defaultOpen=false で初期 props を使用すると折りたたみ状態になる', () => {
    render(
      <Accordion label="My Section" defaultOpen={false}>
        <div>非表示コンテンツ</div>
      </Accordion>
    );
    const content = screen.getByText('非表示コンテンツ');
    // aria-hidden または closed クラスで非表示
    const container = content.closest('[aria-hidden]');
    expect(container).toHaveAttribute('aria-hidden', 'true');
  });

  it('ヘッダークリックで展開/折りたたみが切り替わる', () => {
    render(
      <Accordion label="Toggle Me">
        <div>コンテンツ</div>
      </Accordion>
    );
    const header = screen.getByRole('button', { name: /Toggle Me/ });
    // 開いている（デフォルト）→ クリックで閉じる
    fireEvent.click(header);
    const content = screen.getByText('コンテンツ');
    const container = content.closest('[aria-hidden]');
    expect(container).toHaveAttribute('aria-hidden', 'true');
    // もう一度クリックで開く
    fireEvent.click(header);
    expect(container).toHaveAttribute('aria-hidden', 'false');
  });

  it('aria-expanded がヘッダーの展開状態を反映する', () => {
    render(
      <Accordion label="Section">
        <div>中身</div>
      </Accordion>
    );
    const header = screen.getByRole('button', { name: /Section/ });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });
});
