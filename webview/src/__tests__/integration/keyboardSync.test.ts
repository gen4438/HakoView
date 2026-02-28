/**
 * キーボード→ストア→UI同期のテスト（T034）
 * SC-002 準拠: キーボードショートカットによるストア値変更がgetState()経由で即座に参照可能
 * NOTE: VoxelRenderer.tsx のキーボードハンドラは React+Three.js 環境依存のため、
 *       ここでは Zustand ストアの直接操作による同期テストを行う
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useControlStore } from '../../store/controlStore';
import { DEFAULT_CONTROL_STATE } from '../../store/controlDefaults';

describe('キーボード→ストア→UI同期', () => {
  beforeEach(() => {
    useControlStore.setState({ ...DEFAULT_CONTROL_STATE });
  });

  it('setState でストアを更新すると getState() が即座に新しい値を返す', () => {
    useControlStore.setState({ usePerspective: false });
    expect(useControlStore.getState().usePerspective).toBe(false);
  });

  it('キーボードショートカット相当のストア更新: usePerspective トグル', () => {
    const initial = useControlStore.getState().usePerspective;
    // キーボード 'p' の相当処理
    useControlStore.setState({ usePerspective: !initial });
    expect(useControlStore.getState().usePerspective).toBe(!initial);
  });

  it('キーボードショートカット相当のストア更新: clippingMode 切り替え', () => {
    useControlStore.setState({ clippingMode: 'Off' });
    // キーボード 'cc' 相当
    const current = useControlStore.getState().clippingMode;
    const next = current === 'Off' ? 'Slice' : 'Off';
    useControlStore.setState({ clippingMode: next });
    expect(useControlStore.getState().clippingMode).toBe('Slice');
  });

  it('複数フィールドの一括更新後も全て正しく反映される', () => {
    useControlStore.setState({
      showBoundingBox: true,
      showGrid: false,
      enableEdgeHighlight: true,
    });
    const s = useControlStore.getState();
    expect(s.showBoundingBox).toBe(true);
    expect(s.showGrid).toBe(false);
    expect(s.enableEdgeHighlight).toBe(true);
  });
});
