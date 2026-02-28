import { describe, it, expect, beforeEach } from 'vitest';
import { useControlStore } from '../../store/controlStore';
import { DEFAULT_CONTROL_STATE } from '../../store/controlDefaults';

describe('storeSync (ストア→3Dビュー同期)', () => {
  beforeEach(() => {
    useControlStore.setState({ ...DEFAULT_CONTROL_STATE });
  });

  it('ストア値変更が getState() 経由で即座に参照可能', () => {
    useControlStore.getState().set({ alpha: 0.42 });
    expect(useControlStore.getState().alpha).toBe(0.42);
  });

  it('setState による複数フィールドの即時更新', () => {
    useControlStore.setState({ fov: 90, lightIntensity: 1.5 });
    const state = useControlStore.getState();
    expect(state.fov).toBe(90);
    expect(state.lightIntensity).toBe(1.5);
  });

  it('reset() 後に getState() がデフォルト値を返す', () => {
    useControlStore.setState({ alpha: 0.1, fov: 120 });
    useControlStore.getState().reset();
    const state = useControlStore.getState();
    expect(state.alpha).toBe(DEFAULT_CONTROL_STATE.alpha);
    expect(state.fov).toBe(DEFAULT_CONTROL_STATE.fov);
  });

  it('subscribe でストア変更通知を受け取れる', () => {
    let receivedValue: number | null = null;
    const unsub = useControlStore.subscribe((state) => {
      receivedValue = state.alpha;
    });

    useControlStore.setState({ alpha: 0.77 });
    expect(receivedValue).toBe(0.77);

    unsub();
  });
});
