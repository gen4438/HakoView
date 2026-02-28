# Research: 状態管理とUI実装の技術選定

**Feature**: 002-custom-control-drawer
**Date**: 2026-02-28

---

## 1. 状態管理ライブラリ比較

### 現状の課題

現在の`VoxelRenderer.tsx`（2682行）では以下のパターンでlevaを使用：

```tsx
// leva store → useControls → destructure → props → useEffect → shader uniforms
const [controls, set] = useControls(() => ({
  usePerspective: { value: true },
  alpha: { value: 1.0, min: 0.0, max: 1.0 },
  // ... ~40 controls
}));

// keyboard handler → set() → re-render → useEffect → uniform update
set({ usePerspective: !usePerspective });

// useEffect → shader uniforms
useEffect(() => {
  materialRef.current.uniforms.uAlpha.value = alpha;
  // ...
}, [alpha, lightIntensity, ambientIntensity, ...]);
```

問題点：

- `set()`を呼ぶたびにコンポーネント全体が再レンダリング
- leva UIとカスタムUIの共存が困難（leva独自のCSS-in-JS）
- levaのバンドルサイズ（~40kB min+gzip、stitches含む）
- `useControls`がコンポーネント内でしか使えず、外部からの状態アクセスが煩雑

### 評価軸

| 評価軸                | 重み   | 説明                                                |
| --------------------- | ------ | --------------------------------------------------- |
| React外からの読み書き | **高** | keyboard handler、useFrame内から直接アクセス        |
| 細粒度更新            | **高** | スライダー1つ動かして他40個が再レンダリングされない |
| バンドルサイズ        | **中** | VSCode webview。小さいほど良い                      |
| TypeScript ergonomics | **中** | 型安全、補完が効く                                  |
| 学習コスト            | **低** | チーム（個人）がReact hooks経験あり                 |

---

### Option A: Zustand (推奨)

**バージョン**: zustand@5.0.11
**バンドルサイズ**: ~1.1kB min+gzip (core), ~2.9kB with middleware
**React互換性**: React ≥18.0.0 (peer dependency)
**TypeScript**: ファーストクラスサポート（型推論が優秀）

#### API パターン（本プロジェクト向け）

```typescript
// ---- store/controlStore.ts ----
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface ControlState {
  // Camera
  usePerspective: boolean;
  fov: number;
  far: number;

  // Lighting
  lightIntensity: number;
  ambientIntensity: number;

  // Display
  alpha: number;
  dpr: number;
  enableEdgeHighlight: boolean;
  edgeThickness: number;
  edgeColor: string;
  edgeIntensity: number;
  edgeMaxDistance: number;
  showScaleBar: boolean;
  showBoundingBox: boolean;
  showGrid: boolean;
  useOccupancy: boolean;

  // Clipping
  clippingMode: 'Off' | 'Slice' | 'Custom';
  sliceAxis: 'X' | 'Y' | 'Z';
  slicePosition1X: number;
  slicePosition2X: number;
  slicePosition1Y: number;
  slicePosition2Y: number;
  slicePosition1Z: number;
  slicePosition2Z: number;
  customNormalX: number;
  customNormalY: number;
  customNormalZ: number;
  customDistance: number;

  // Colors (16 entries)
  customColors: string[];
  valueVisibility: boolean[];

  // Actions
  set: (partial: Partial<ControlState>) => void;
  reset: () => void;
}

const DEFAULT_STATE = {
  usePerspective: true,
  fov: 50,
  far: 2000,
  lightIntensity: 1.0,
  ambientIntensity: 0.2,
  alpha: 1.0,
  // ... etc
};

export const useControlStore = create<ControlState>()(
  subscribeWithSelector((set) => ({
    ...DEFAULT_STATE,
    set: (partial) => set(partial),
    reset: () => set(DEFAULT_STATE),
  }))
);
```

#### React外からの読み書き（keyboard handler）

```typescript
// keyboard handler — React外からstore直接操作
const handleKeyDown = (event: KeyboardEvent) => {
  const { usePerspective, enableEdgeHighlight } = useControlStore.getState();

  switch (event.key) {
    case 'p':
      useControlStore.setState({ usePerspective: !usePerspective });
      break;
    case 'e':
      useControlStore.setState({ enableEdgeHighlight: !enableEdgeHighlight });
      break;
  }
};

// イベントリスナーの登録（Reactコンポーネント外でもOK）
window.addEventListener('keydown', handleKeyDown);
```

#### useFrame内からの直接読み取り（再レンダリングなし）

```typescript
// Three.js render loop — storeから直接読み取り
useFrame(() => {
  if (!materialRef.current) return;
  const u = materialRef.current.uniforms;
  const state = useControlStore.getState(); // re-renderを引き起こさない

  u.uAlpha.value = state.alpha;
  u.uLightIntensity.value = state.lightIntensity;
  // ...
});
```

#### 細粒度コンポーネント購読

```tsx
// 個別スライダー — alphaが変わっても他のスライダーは再レンダリングされない
const AlphaSlider: React.FC = () => {
  const alpha = useControlStore((s) => s.alpha);
  const set = useControlStore((s) => s.set);

  return <Slider value={alpha} min={0} max={1} step={0.01} onChange={(v) => set({ alpha: v })} />;
};

// Boolean toggle — usePerspectiveのみ購読
const PerspectiveToggle: React.FC = () => {
  const usePerspective = useControlStore((s) => s.usePerspective);
  const set = useControlStore((s) => s.set);

  return <Toggle checked={usePerspective} onChange={(v) => set({ usePerspective: v })} />;
};
```

#### subscribeWithSelector でReact外からの変更監視

```typescript
// 例: shader uniform更新を購読ベースに（useEffectの代替）
useEffect(() => {
  const unsub = useControlStore.subscribe(
    (s) => s.alpha,
    (alpha) => {
      if (materialRef.current) {
        materialRef.current.uniforms.uAlpha.value = alpha;
      }
    }
  );
  return unsub;
}, []);
```

#### 評価

| 評価軸                | スコア | 理由                                                                 |
| --------------------- | ------ | -------------------------------------------------------------------- |
| React外からの読み書き | ★★★★★  | `getState()` / `setState()` / `subscribe()` がstore objectに直接存在 |
| 細粒度更新            | ★★★★★  | セレクタベースの購読。`(s) => s.alpha`で1つだけ購読                  |
| バンドルサイズ        | ★★★★★  | ~1.1kB min+gzip。levaの~40kBから激減                                 |
| TypeScript            | ★★★★☆  | 型推論良好。middleware使用時のジェネリクスがやや冗長                 |
| 学習コスト            | ★★★★★  | `useState`感覚。APIが極めてシンプル                                  |

---

### Option B: Jotai

**バージョン**: jotai@2.18.0
**バンドルサイズ**: ~3.7kB min+gzip (core), ~8.1kB with utils
**React互換性**: React ≥17.0.0
**TypeScript**: 良好（アトムごとの型付け）

#### API パターン

```typescript
// ---- atoms/controlAtoms.ts ----
import { atom } from 'jotai';

// 個別のアトム
export const alphaAtom = atom(1.0);
export const usePerspectiveAtom = atom(true);
export const fovAtom = atom(50);
export const lightIntensityAtom = atom(1.0);
export const edgeHighlightAtom = atom(true);
// ... ~40 atoms

// 派生アトム（必要に応じて）
export const slicePosition1Atom = atom((get) => {
  const axis = get(sliceAxisAtom);
  switch (axis) {
    case 'X':
      return get(slicePosition1XAtom);
    case 'Y':
      return get(slicePosition1YAtom);
    case 'Z':
      return get(slicePosition1ZAtom);
  }
});
```

#### React外からのアクセス（問題点）

```typescript
import { createStore } from 'jotai';

// jotai storeを作成（React外でも操作可能にするため）
export const controlStore = createStore();

// keyboard handler
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'p': {
      const current = controlStore.get(usePerspectiveAtom);
      controlStore.set(usePerspectiveAtom, !current);
      break;
    }
  }
};

// ⚠️ 注意: createStore()で作成したstoreをProviderに渡す必要あり
// <Provider store={controlStore}>...</Provider>
```

#### 細粒度コンポーネント

```tsx
const AlphaSlider: React.FC = () => {
  const [alpha, setAlpha] = useAtom(alphaAtom);
  return <Slider value={alpha} onChange={setAlpha} />;
};
```

#### useFrame内からの読み取り

```typescript
// ⚠️ jotai は useAtom() がReactフック前提
// useFrame内で直接読み取るにはcreateStore()のget()を使う
useFrame(() => {
  if (!materialRef.current) return;
  const u = materialRef.current.uniforms;
  u.uAlpha.value = controlStore.get(alphaAtom);
  // 40個のアトムそれぞれにget()が必要
});
```

#### 評価

| 評価軸                | スコア | 理由                                                                     |
| --------------------- | ------ | ------------------------------------------------------------------------ |
| React外からの読み書き | ★★★☆☆  | `createStore()`が必要。Providerに渡す手間。ZustandのgetState()より間接的 |
| 細粒度更新            | ★★★★★  | アトム単位で本質的に細粒度。ただし40個のアトム管理は煩雑                 |
| バンドルサイズ        | ★★★★☆  | ~3.7kB。Zustandより少し大きいがlevaよりはるかに小さい                    |
| TypeScript            | ★★★★☆  | アトムごとの型は明確。ただし40アトムの型管理が冗長                       |
| 学習コスト            | ★★★☆☆  | atom/derived atom/createStoreの概念理解が必要。Zustandよりステップ多い   |

---

### Option C: useReducer + Context

**バンドルサイズ**: 0kB（React組み込み）
**React互換性**: 任意
**TypeScript**: 完全サポート

#### API パターン

```typescript
// ---- context/ControlContext.tsx ----
type ControlAction =
  | { type: 'SET_ALPHA'; value: number }
  | { type: 'SET_PERSPECTIVE'; value: boolean }
  | { type: 'SET_FOV'; value: number }
  // ... ~40 action types
  | { type: 'RESET' };

function controlReducer(state: ControlState, action: ControlAction): ControlState {
  switch (action.type) {
    case 'SET_ALPHA':
      return { ...state, alpha: action.value };
    case 'SET_PERSPECTIVE':
      return { ...state, usePerspective: action.value };
    // ... 大量のcase文
    case 'RESET':
      return DEFAULT_STATE;
    default:
      return state;
  }
}

const ControlContext = createContext<{
  state: ControlState;
  dispatch: React.Dispatch<ControlAction>;
} | null>(null);
```

#### React外からのアクセス（致命的問題）

```typescript
// ❌ Context/useReducerはReactコンポーネント外からアクセスする標準手段がない
// refs経由のハックが必要：

const dispatchRef = useRef<React.Dispatch<ControlAction>>();
const stateRef = useRef<ControlState>();

// コンポーネント内で同期
useEffect(() => {
  dispatchRef.current = dispatch;
  stateRef.current = state;
}, [dispatch, state]);

// keyboard handler
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'p') {
    // ⚠️ stateRef.currentがstaleになるリスク
    dispatchRef.current?.({ type: 'SET_PERSPECTIVE', value: !stateRef.current?.usePerspective });
  }
};
```

#### 細粒度更新（致命的問題）

```tsx
// ❌ Contextの値が変わるとすべてのConsumerが再レンダリング
// React.memoで防げるが、stateオブジェクト丸ごとがContextに入っているため
// セレクタベースの購読が不可能

// 回避策: 複数のContextに分割
const CameraContext = createContext(null);
const LightingContext = createContext(null);
const DisplayContext = createContext(null);
const ClippingContext = createContext(null);
const ColorContext = createContext(null);
// → Provider地獄 + 分割の粒度問題
```

#### 評価

| 評価軸                | スコア | 理由                                                  |
| --------------------- | ------ | ----------------------------------------------------- |
| React外からの読み書き | ★☆☆☆☆  | ref経由のハック必須。stale state問題あり              |
| 細粒度更新            | ★★☆☆☆  | Context分割またはuseSyncExternalStoreの自前実装が必要 |
| バンドルサイズ        | ★★★★★  | 0kB追加                                               |
| TypeScript            | ★★★☆☆  | Action type unionが大量で冗長                         |
| 学習コスト            | ★★★★☆  | React標準だが、外部アクセスの回避策が非自明           |

---

### 比較サマリー

| 項目                          | Zustand                | Jotai                   | useReducer+Context |
| ----------------------------- | ---------------------- | ----------------------- | ------------------ |
| **バンドルサイズ** (min+gzip) | **~1.1kB**             | ~3.7kB                  | 0kB                |
| **React外からの読み書き**     | **★★★★★**              | ★★★☆☆                   | ★☆☆☆☆              |
| **細粒度更新**                | **★★★★★**              | ★★★★★                   | ★★☆☆☆              |
| **useFrame内アクセス**        | **★★★★★** `getState()` | ★★★☆☆ `store.get(atom)` | ★☆☆☆☆ ref hack     |
| **keyboard handler連携**      | **★★★★★** `setState()` | ★★★☆☆ `store.set()`     | ★☆☆☆☆ dispatch ref |
| **TypeScript ergonomics**     | **★★★★☆**              | ★★★★☆                   | ★★★☆☆              |
| **学習コスト**                | **★★★★★**              | ★★★☆☆                   | ★★★★☆              |
| **40コントロールの管理**      | **★★★★★** 1 store      | ★★★☆☆ 40 atoms          | ★★☆☆☆ 巨大reducer  |
| **R3F ecosystem親和性**       | **★★★★★** 公式推奨     | ★★★★☆                   | ★★☆☆☆              |

### 結論: **Zustand を推奨**

理由：

1. **React外アクセスがネイティブ**: `getState()`/`setState()`がstore objectに直接存在。keyboard handlerとuseFrame内の両方で自然に使える
2. **最小バンドルサイズ**: ~1.1kBはleva(-40kB)と比較して劇的削減。jotaiの1/3
3. **R3F公式推奨**: React Three Fiber公式ドキュメントでZustandを推奨（useFrameでの非レンダリング読み取りパターン）
4. **1 storeで40コントロール管理**: Jotaiの40アトム管理と比較して圧倒的にシンプル
5. **subscribeWithSelector**: 個別値の変更を購読可能。shader uniform更新を宣言的に記述可能
6. **現在のlevaパターンからの移行コスト最小**: `set({ key: value })`パターンがlevaの`set()`とほぼ同一

**推奨バージョン**: `zustand@5.0.11`（最新v5系、React 18対応）

---

## 2. CSS-only ドロワーアニメーション

### ベストプラクティス

VSCode webview内ではJavaScriptアニメーションライブラリ（framer-motion等）は不要。CSS `transform` + `transition`が最もパフォーマンスが高い。

#### 推奨パターン: `transform: translateX()` + CSS transition

```css
/* ドロワーコンテナ */
.drawer {
  position: fixed;
  top: 0;
  right: 0;
  width: 320px;
  height: 100%;
  /* GPU合成レイヤーでアニメーション（layoutを引き起こさない） */
  transform: translateX(100%); /* 閉じた状態: 画面外 */
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  /* will-change は常時指定しない（アニメーション中のみが理想だがCSS-onlyでは妥協） */
  z-index: 100;
  overflow-y: auto;
}

.drawer.open {
  transform: translateX(0); /* 開いた状態: 画面内 */
}

/* 3Dビューエリア（ドロワー分縮む） */
.viewport {
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
}

.viewport.drawer-open {
  width: calc(100% - 320px);
}
```

#### なぜ `transform` か

| プロパティ                | Layout | Paint | Composite | パフォーマンス |
| ------------------------- | ------ | ----- | --------- | -------------- |
| `left`/`right`            | ✅     | ✅    | ✅        | ❌ 遅い        |
| `margin-right`            | ✅     | ✅    | ✅        | ❌ 遅い        |
| `transform: translateX()` | ❌     | ❌    | ✅        | ✅ 高速        |
| `width` (viewport)        | ✅     | ✅    | ✅        | △ 必要悪       |

- `transform`はcomposite-onlyのため、ブラウザのメインスレッドをブロックしない
- Canvasのリサイズ（viewport width変更）はlayoutが必要だが、これは避けられない
- ドロワー自体のスライドは`transform`で処理し、viewportのwidth変更のみlayout triggerにする

#### cubic-bezier選択

```
cubic-bezier(0.4, 0, 0.2, 1)  — Material Design "standard easing"
```

- 開始時: ゆっくり加速（0.4, 0）
- 終了時: 適度に減速（0.2, 1）
- 自然で軽快な印象。ドロワーの開閉に最適

#### トグルボタンの配置

```css
.drawer-toggle {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  /* ドロワーが開いたら一緒に移動 */
  transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 101;
}

.drawer-toggle.drawer-open {
  right: 320px;
}
```

---

## 3. VSCode CSS変数（`--vscode-*`）によるテーミング

### 仕組み

VSCodeはwebview内で自動的に[テーマ対応CSS変数](https://code.visualstudio.com/api/references/theme-color)を注入する。ユーザーがテーマを切り替えると変数値が自動更新される。

### 主要な変数と用途

```css
/* ドロワー背景 */
.drawer {
  background-color: var(--vscode-sideBar-background);
  border-left: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
  color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
}

/* タブ */
.tab {
  background-color: var(--vscode-tab-inactiveBackground);
  color: var(--vscode-tab-inactiveForeground);
  border-bottom: 1px solid var(--vscode-tab-border);
}
.tab.active {
  background-color: var(--vscode-tab-activeBackground);
  color: var(--vscode-tab-activeForeground);
  border-bottom: 2px solid var(--vscode-focusBorder);
}

/* コントロール（スライダー、セレクト） */
.control-label {
  color: var(--vscode-foreground);
  font-size: var(--vscode-font-size, 13px);
  font-family: var(--vscode-font-family);
}

input[type='range'] {
  accent-color: var(--vscode-focusBorder);
}

/* input / select */
.control-input {
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent);
}
.control-input:focus {
  outline: 1px solid var(--vscode-focusBorder);
}

/* ボタン */
.action-button {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 4px 12px;
  cursor: pointer;
}
.action-button:hover {
  background-color: var(--vscode-button-hoverBackground);
}

/* セパレーター / アコーディオン */
.accordion-header {
  background-color: var(--vscode-sideBarSectionHeader-background);
  color: var(--vscode-sideBarSectionHeader-foreground);
  border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, transparent);
}

/* トグルスイッチ */
.toggle-track {
  background-color: var(--vscode-input-background);
}
.toggle-track.checked {
  background-color: var(--vscode-inputOption-activeBackground, var(--vscode-focusBorder));
}

/* スクロールバー */
.drawer::-webkit-scrollbar {
  width: 10px;
}
.drawer::-webkit-scrollbar-thumb {
  background-color: var(--vscode-scrollbarSlider-background);
}
.drawer::-webkit-scrollbar-thumb:hover {
  background-color: var(--vscode-scrollbarSlider-hoverBackground);
}
```

### テーマ検出（body属性）

VSCodeはwebviewの`body`要素に以下の属性を付与：

```css
/* ダークテーマ */
body[data-vscode-theme-kind='vscode-dark'] {
}

/* ライトテーマ */
body[data-vscode-theme-kind='vscode-light'] {
}

/* ハイコントラスト */
body[data-vscode-theme-kind='vscode-high-contrast'] {
}
body[data-vscode-theme-kind='vscode-high-contrast-light'] {
}
```

ハイコントラスト固有の対応:

```css
body[data-vscode-theme-kind='vscode-high-contrast'] .drawer {
  border-left: 2px solid var(--vscode-contrastBorder);
}

body[data-vscode-theme-kind='vscode-high-contrast'] .control-input {
  border: 1px solid var(--vscode-contrastBorder);
}
```

### 注意点

- `--vscode-*`変数は**webview読み込み時に自動注入**される。追加設定不要
- テーマ切り替え時はCSS変数の値が自動更新されるが、**webviewは再レンダリングされない**（CSS変数の変更はリアクティブに適用される）
- **カスタムプロパティのfallback**を必ず指定すること（一部の変数は特定テーマでundefined）
- `font-family`と`font-size`もVSCode変数を使うことで、ユーザーのエディタ設定と一貫性を保つ

---

## 4. React.lazy / Suspense によるタブ内容の遅延読み込み

### 本プロジェクトでの実用性: **不要（非推奨）**

#### 理由

1. **バンドル構成**: esbuild.webview.jsが単一IIFE出力（`format: 'iife'`）。コードスプリッティングが有効にならない

   ```javascript
   // esbuild.webview.js
   format: 'iife',  // 単一ファイル出力 → dynamic importはインライン化される
   ```

2. **コンポーネントサイズ**: タブ内容は純粋なコントロールUI（スライダー、トグル、カラーピッカー）。各タブ2-5KBの小さなコンポーネント群。遅延読み込みのオーバーヘッドの方が大きい

3. **初回表示**: ドロワーを開いたとき全タブのUIは即座に利用可能であるべき。Suspense fallbackのローディング表示はUX悪化

4. **esbuildの制約**: IIFEフォーマットではdynamic importがサポートされるがchunkが分割されない（同一バンドルにインライン化される）

#### 代替推奨: 条件付きレンダリング

```tsx
// タブの内容は常にマウント済み、visibility切り替えで表示制御
// → stateが保持され、切り替えが瞬時
const DrawerContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('display');

  return (
    <>
      <TabBar activeTab={activeTab} onChange={setActiveTab} />
      {/* display: none で非表示にし、DOMは保持 */}
      <div style={{ display: activeTab === 'display' ? 'block' : 'none' }}>
        <DisplayTab />
      </div>
      <div style={{ display: activeTab === 'camera' ? 'block' : 'none' }}>
        <CameraTab />
      </div>
      <div style={{ display: activeTab === 'colors' ? 'block' : 'none' }}>
        <ColorsTab />
      </div>
      <div style={{ display: activeTab === 'clipping' ? 'block' : 'none' }}>
        <ClippingTab />
      </div>
    </>
  );
};
```

**`display: none`方式のメリット**:

- タブ切り替えが即座（マウント/アンマウントなし）
- コントロール値が保持される（FR-007）
- スクロール位置が保持される
- `React.lazy`のSuspense boundsやローディング状態が不要

---

## 5. 推奨アーキテクチャまとめ

### データフロー図

```
┌─────────────────────────────────────────────────────────┐
│                    Zustand Store                         │
│  useControlStore (single store, ~40 fields)             │
│                                                          │
│  .getState()  ← keyboard handler (React外)              │
│  .setState()  ← keyboard handler / UI components        │
│  .subscribe() ← shader uniform updater                  │
│  useControlStore(selector) ← UI components (fine-grained)│
└──────────┬──────────────────┬────────────────┬──────────┘
           │                  │                │
           ▼                  ▼                ▼
┌──────────────┐  ┌──────────────────┐  ┌────────────────┐
│ Drawer UI    │  │ Keyboard Handler │  │ VoxelScene     │
│ (React)      │  │ (vanilla JS)     │  │ (useFrame)     │
│              │  │                  │  │                │
│ Slider ──────┤  │ getState() ──────┤  │ getState() ────┤
│ Toggle ──────┤  │ setState() ──────┤  │ → uniforms     │
│ ColorPicker ─┤  │                  │  │                │
│ Select ──────┤  │                  │  │                │
└──────────────┘  └──────────────────┘  └────────────────┘
```

### 技術スタック

| 項目                   | 選択                           | 理由                                   |
| ---------------------- | ------------------------------ | -------------------------------------- |
| 状態管理               | **zustand@5**                  | 外部アクセス、細粒度更新、最小バンドル |
| ドロワーアニメーション | **CSS transform + transition** | GPU composite-only、ライブラリ不要     |
| テーミング             | **--vscode-\* CSS変数**        | VSCodeテーマと自動同期                 |
| タブ内容切り替え       | **display: none 条件切り替え** | 値保持、即時切り替え                   |
| カラーピッカー         | **input[type=color]** (FR-011) | ネイティブ、追加バンドルなし           |

### バンドルサイズ影響

| 変更        | サイズ変化            |
| ----------- | --------------------- |
| leva 削除   | **-40kB** (min+gzip)  |
| zustand追加 | **+1.1kB** (min+gzip) |
| **純削減**  | **~39kB 削減**        |

---

## 6. Zustand Store の具体設計案

### ファイル構成

```
webview/src/
  store/
    controlStore.ts      # メインstore定義
    controlDefaults.ts   # デフォルト値定義
    controlTypes.ts      # 型定義
    controlSelectors.ts  # よく使うセレクタ（オプション）
```

### controlTypes.ts

```typescript
export type ClippingMode = 'Off' | 'Slice' | 'Custom';
export type SliceAxis = 'X' | 'Y' | 'Z';

export interface ControlState {
  // ---- Camera ----
  usePerspective: boolean;
  fov: number;
  far: number;

  // ---- Lighting ----
  lightIntensity: number;
  ambientIntensity: number;

  // ---- Display ----
  alpha: number;
  dpr: number;
  useOccupancy: boolean;
  enableEdgeHighlight: boolean;
  edgeThickness: number;
  edgeColor: string;
  edgeIntensity: number;
  edgeMaxDistance: number;
  showScaleBar: boolean;
  showBoundingBox: boolean;
  showGrid: boolean;

  // ---- Clipping ----
  clippingMode: ClippingMode;
  sliceAxis: SliceAxis;
  slicePosition1X: number;
  slicePosition2X: number;
  slicePosition1Y: number;
  slicePosition2Y: number;
  slicePosition1Z: number;
  slicePosition2Z: number;
  customNormalX: number;
  customNormalY: number;
  customNormalZ: number;
  customDistance: number;

  // ---- Colors ----
  customColors: string[];
  valueVisibility: boolean[];
}

// Actions は ControlState に含めず、storeの返却型に含める
export interface ControlActions {
  set: (partial: Partial<ControlState>) => void;
  reset: () => void;
  updateColor: (index: number, color: string) => void;
  updateVisibility: (index: number, visible: boolean) => void;
}

export type ControlStore = ControlState & ControlActions;
```

### controlStore.ts

```typescript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ControlStore, ControlState } from './controlTypes';
import { DEFAULT_CONTROL_STATE } from './controlDefaults';

export const useControlStore = create<ControlStore>()(
  subscribeWithSelector((set, get) => ({
    ...DEFAULT_CONTROL_STATE,

    set: (partial) => set(partial),

    reset: () => set(DEFAULT_CONTROL_STATE),

    updateColor: (index, color) =>
      set((state) => {
        const newColors = [...state.customColors];
        newColors[index] = color;
        return { customColors: newColors };
      }),

    updateVisibility: (index, visible) =>
      set((state) => {
        const newVisibility = [...state.valueVisibility];
        newVisibility[index] = visible;
        return { valueVisibility: newVisibility };
      }),
  }))
);
```

### 移行パターン（levaからの書き換え）

**Before (leva)**:

```tsx
const [controls, set] = useControls(() => ({
  alpha: { value: 1.0, min: 0, max: 1, step: 0.01 },
}));
const { alpha } = controls;

// keyboard
set({ usePerspective: !usePerspective });

// useEffect for uniforms
useEffect(() => {
  materialRef.current.uniforms.uAlpha.value = alpha;
}, [alpha]);
```

**After (zustand)**:

```tsx
// UI component (fine-grained)
const alpha = useControlStore((s) => s.alpha);

// keyboard handler (outside React)
const { usePerspective } = useControlStore.getState();
useControlStore.setState({ usePerspective: !usePerspective });

// useFrame (no re-render)
useFrame(() => {
  const { alpha } = useControlStore.getState();
  materialRef.current.uniforms.uAlpha.value = alpha;
});
```
