import { describe, it, expect, beforeEach } from 'vitest';
import { useControlStore } from '../../store/controlStore';
import {
  DEFAULT_CONTROL_STATE,
  DEFAULT_PALETTE,
  DEFAULT_VISIBILITY,
} from '../../store/controlDefaults';

describe('controlStore', () => {
  beforeEach(() => {
    // 各テスト前にストアをリセット
    useControlStore.setState({ ...DEFAULT_CONTROL_STATE });
  });

  describe('初期状態', () => {
    it('デフォルト値で初期化される', () => {
      const state = useControlStore.getState();
      expect(state.alpha).toBe(DEFAULT_CONTROL_STATE.alpha);
      expect(state.usePerspective).toBe(DEFAULT_CONTROL_STATE.usePerspective);
      expect(state.fov).toBe(DEFAULT_CONTROL_STATE.fov);
      expect(state.customColors).toEqual(DEFAULT_PALETTE);
      expect(state.valueVisibility).toEqual(DEFAULT_VISIBILITY);
    });
  });

  describe('set アクション', () => {
    it('部分的な状態を更新する', () => {
      const { set } = useControlStore.getState();
      set({ alpha: 0.5 });
      expect(useControlStore.getState().alpha).toBe(0.5);
    });

    it('指定されていないフィールドは変更しない', () => {
      const { set } = useControlStore.getState();
      const beforeFov = useControlStore.getState().fov;
      set({ alpha: 0.5 });
      expect(useControlStore.getState().fov).toBe(beforeFov);
    });

    it('複数フィールドを同時更新できる', () => {
      const { set } = useControlStore.getState();
      set({ alpha: 0.3, fov: 75 });
      const state = useControlStore.getState();
      expect(state.alpha).toBe(0.3);
      expect(state.fov).toBe(75);
    });
  });

  describe('reset アクション', () => {
    it('全フィールドをデフォルト値に戻す', () => {
      const { set, reset } = useControlStore.getState();
      set({ alpha: 0.3, fov: 120, usePerspective: false });
      reset();
      const state = useControlStore.getState();
      expect(state.alpha).toBe(DEFAULT_CONTROL_STATE.alpha);
      expect(state.fov).toBe(DEFAULT_CONTROL_STATE.fov);
      expect(state.usePerspective).toBe(DEFAULT_CONTROL_STATE.usePerspective);
    });

    it('customColors をデフォルトパレットに戻す', () => {
      const { updateColor, reset } = useControlStore.getState();
      updateColor(1, '#123456');
      reset();
      expect(useControlStore.getState().customColors[1]).toBe(DEFAULT_PALETTE[1]);
    });
  });

  describe('updateColor アクション', () => {
    it('指定インデックスの色を更新する', () => {
      const { updateColor } = useControlStore.getState();
      updateColor(3, '#aabbcc');
      expect(useControlStore.getState().customColors[3]).toBe('#aabbcc');
    });

    it('他のインデックスの色は変更しない', () => {
      const { updateColor } = useControlStore.getState();
      updateColor(3, '#aabbcc');
      expect(useControlStore.getState().customColors[0]).toBe(DEFAULT_PALETTE[0]);
      expect(useControlStore.getState().customColors[5]).toBe(DEFAULT_PALETTE[5]);
    });

    it('新しい配列参照を返す（不変性）', () => {
      const { updateColor } = useControlStore.getState();
      const before = useControlStore.getState().customColors;
      updateColor(1, '#ffffff');
      const after = useControlStore.getState().customColors;
      expect(after).not.toBe(before);
    });
  });

  describe('updateVisibility アクション', () => {
    it('指定インデックスの可視性を更新する', () => {
      const { updateVisibility } = useControlStore.getState();
      updateVisibility(0, true); // 0 はデフォルト false
      expect(useControlStore.getState().valueVisibility[0]).toBe(true);
    });

    it('他のインデックスの可視性は変更しない', () => {
      const { updateVisibility } = useControlStore.getState();
      updateVisibility(0, true);
      expect(useControlStore.getState().valueVisibility[1]).toBe(DEFAULT_VISIBILITY[1]);
    });

    it('新しい配列参照を返す（不変性）', () => {
      const { updateVisibility } = useControlStore.getState();
      const before = useControlStore.getState().valueVisibility;
      updateVisibility(1, false);
      const after = useControlStore.getState().valueVisibility;
      expect(after).not.toBe(before);
    });
  });

  describe('setSlicePosition アクション', () => {
    it('sliceAxis=Z の場合に slicePosition1Z を更新する', () => {
      const { set, setSlicePosition } = useControlStore.getState();
      set({ sliceAxis: 'Z' });
      setSlicePosition(1, 10);
      expect(useControlStore.getState().slicePosition1Z).toBe(10);
    });

    it('sliceAxis=Z の場合に slicePosition2Z を更新する', () => {
      const { set, setSlicePosition } = useControlStore.getState();
      set({ sliceAxis: 'Z' });
      setSlicePosition(2, 20);
      expect(useControlStore.getState().slicePosition2Z).toBe(20);
    });

    it('sliceAxis=X の場合に slicePosition1X を更新する', () => {
      const { set, setSlicePosition } = useControlStore.getState();
      set({ sliceAxis: 'X' });
      setSlicePosition(1, 5);
      expect(useControlStore.getState().slicePosition1X).toBe(5);
    });

    it('sliceAxis=Y の場合に slicePosition1Y を更新する', () => {
      const { set, setSlicePosition } = useControlStore.getState();
      set({ sliceAxis: 'Y' });
      setSlicePosition(1, 7);
      expect(useControlStore.getState().slicePosition1Y).toBe(7);
    });
  });

  describe('initDefaults アクション', () => {
    it('dpr を maxDpr に設定する', () => {
      const { initDefaults } = useControlStore.getState();
      initDefaults({ x: 10, y: 20, z: 30 }, 2.0);
      expect(useControlStore.getState().dpr).toBe(2.0);
    });

    it('slicePosition2 を各次元サイズに設定する', () => {
      const { initDefaults } = useControlStore.getState();
      initDefaults({ x: 10, y: 20, z: 30 }, 1.5);
      const state = useControlStore.getState();
      expect(state.slicePosition2X).toBe(10);
      expect(state.slicePosition2Y).toBe(20);
      expect(state.slicePosition2Z).toBe(30);
    });
  });
});
