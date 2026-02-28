/**
 * フォーカス管理ユーティリティ（T037）
 * component-api.md のフォーカス管理契約に準拠（FR-022）
 */

/**
 * 入力フィールドにフォーカスがあるかを検査する。
 * true を返す場合、グローバルキーボードショートカットハンドラは処理をスキップする。
 */
export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) {return false;}
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    el.getAttribute('contenteditable') === 'true'
  );
}
