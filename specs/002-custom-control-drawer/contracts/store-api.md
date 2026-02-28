# Contracts: Zustand ストアAPI

**Feature**: 002-custom-control-drawer
**Date**: 2026-02-28

## ストアアクセスパターン

### 1. React コンポーネントからの購読（UI → ストア → UI）

```typescript
// 細粒度セレクタ — 変更された値のみ再レンダリング
const alpha = useControlStore((s) => s.alpha);
const set = useControlStore((s) => s.set);

// 変更
set({ alpha: 0.5 });
```

**契約**:

- セレクタが返す値が `Object.is` で等価な場合、再レンダリングは発生しない
- `set()` は `Partial<ControlState>` を受け取り、浅いマージを行う
- 配列（`customColors`, `valueVisibility`）は新しい配列参照が必要

### 2. キーボードハンドラからの操作（外部 → ストア）

```typescript
// React外からの読み取り
const { usePerspective } = useControlStore.getState();

// React外からの更新（UIに自動反映）
useControlStore.setState({ usePerspective: !usePerspective });
```

**契約**:

- `getState()` は常に最新の状態を返す（stale closureの問題なし）
- `setState()` は `set()` アクションと同一の動作
- UIコンポーネントのセレクタが変更を検知し、再レンダリングをトリガーする

### 3. Three.js レンダリングからの読み取り（ストア → GPU）

```typescript
useFrame(() => {
  const state = useControlStore.getState();
  const u = materialRef.current.uniforms;
  u.uAlpha.value = state.alpha;
  u.uLightIntensity.value = state.lightIntensity;
  // ... 各uniform
});
```

**契約**:

- `getState()` は React の再レンダリングを引き起こさない
- 毎フレーム呼び出しても性能上の問題はない（単なるオブジェクト参照返却）

### 4. 購読ベースのuniform更新（代替パターン）

```typescript
useEffect(() => {
  const unsub = useControlStore.subscribe(
    (s) => ({ alpha: s.alpha, lightIntensity: s.lightIntensity }),
    (vals) => {
      const u = materialRef.current.uniforms;
      u.uAlpha.value = vals.alpha;
      u.uLightIntensity.value = vals.lightIntensity;
    },
    { equalityFn: shallow }
  );
  return unsub;
}, []);
```

**契約**:

- `subscribeWithSelector` ミドルウェアが有効な場合のみ利用可能
- `equalityFn` でオブジェクトの浅い比較が可能
- アンサブスクライブ関数を返すため、useEffectのクリーンアップで使用する

## アクション一覧

| アクション名       | 引数                                | 説明                                     |
| ------------------ | ----------------------------------- | ---------------------------------------- |
| `set`              | `Partial<ControlState>`             | 任意のフィールドを部分更新               |
| `reset`            | なし                                | 全フィールドをデフォルト値にリセット     |
| `updateColor`      | `(index: number, color: string)`    | 指定インデックスのカスタムカラーを更新   |
| `updateVisibility` | `(index: number, visible: boolean)` | 指定インデックスの可視性を更新           |
| `setSlicePosition` | `(slice: 1 \| 2, value: number)`    | 現在のsliceAxisに基づくスライス位置更新  |
| `initDefaults`     | `(dims, maxDpr)`                    | ボクセルデータ依存のデフォルト値を初期化 |

## ドロワーコンポーネントインターフェース

### Drawer

```typescript
interface DrawerProps {
  isOpen: boolean;
  onToggle: () => void;
}
```

### TabBar

```typescript
interface TabBarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}
```

### コントロール部品

```typescript
// スライダー
interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

// トグル
interface ToggleControlProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

// カラーピッカー
interface ColorControlProps {
  label: string;
  value: string; // hex color
  onChange: (color: string) => void;
}

// セレクト
interface SelectControlProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

// ボタン
interface ButtonControlProps {
  label: string;
  onClick: () => void;
}

// アコーディオン
interface AccordionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}
```

## 既存メッセージングプロトコルへの影響

本機能は既存のExtension ↔ Webview メッセージングプロトコルを**変更しない**。

以下のメッセージは引き続きそのまま使用:

- `saveColorSettings` (Webview → Extension): カラー設定保存
- `openSettings` (Webview → Extension): 設定画面を開く
- `updateSettings` (Extension → Webview): ViewerSettings更新（colormap, devicePixelRatio）

カラー操作は既に `VoxelRenderer` 内に実装されているため、ドロワーUIからの操作は既存のコールバック経路を再利用する。
