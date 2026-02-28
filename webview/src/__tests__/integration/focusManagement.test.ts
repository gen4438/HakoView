/**
 * フォーカス管理のテスト（T035）
 * FR-022 準拠: input フォーカス時のショートカット抑制、Escape フォーカス解除
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isInputFocused } from '../../utils/focusUtils';

describe('isInputFocused', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('フォーカスなしの場合は false を返す', () => {
    // body にフォーカスを当てる（input ではない）
    document.body.focus();
    expect(isInputFocused()).toBe(false);
  });

  it('input 要素にフォーカスがあるときは true を返す', () => {
    const input = document.createElement('input');
    container.appendChild(input);
    input.focus();
    expect(isInputFocused()).toBe(true);
  });

  it('textarea 要素にフォーカスがあるときは true を返す', () => {
    const textarea = document.createElement('textarea');
    container.appendChild(textarea);
    textarea.focus();
    expect(isInputFocused()).toBe(true);
  });

  it('select 要素にフォーカスがあるときは true を返す', () => {
    const select = document.createElement('select');
    container.appendChild(select);
    select.focus();
    expect(isInputFocused()).toBe(true);
  });

  it('contenteditable 要素にフォーカスがあるときは true を返す', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    container.appendChild(div);
    div.focus();
    expect(isInputFocused()).toBe(true);
  });
});
