# 複数タブ時のパフォーマンス課題

## 概要

Hakoviewで複数のタブを開いた際に、アクティブなタブのFPSが低下する問題が発生した。
本ドキュメントでは調査結果、暫定対策、および今後の改善方針をまとめる。

## 問題

- **症状**: タブを3つ以上開くと、アクティブなタブのFPSが低下する
- **条件**: 小さなモデルでも発生。モデルサイズに依存しない
- **閾値**: 2タブでは問題なし、3タブから顕在化

## 原因調査

### retainContextWhenHidden: true の影響

`VoxelEditorProvider` は `retainContextWhenHidden: true` で登録されており、
非表示タブのwebview iframeはDOMに残り続ける。

### R3F (React Three Fiber) の内部動作

R3Fのフレームループ（`createLoop`）を調査した結果:

1. **rAFループ**: `frameloop="demand"` モードでは、`invalidate()` が呼ばれない限りレンダリングは行われず、ループ自体も停止する（`cancelAnimationFrame`）
2. **Canvas unmount時**: `state.internal.active = false` が即座に設定され、500ms後に `forceContextLoss()` → `dispose()` → `roots.delete()` でWebGLコンテキストとGPUリソースが完全解放される
3. **Statsのグローバルエフェクト**: `addEffect`/`addAfterEffect` で登録されるが、Canvasアンマウント時にuseEffectクリーンアップで解除される

→ **R3FのrAFループとWebGLコンテキストは正しくクリーンアップされている。**

### 真のボトルネック: GCオーバーヘッド

Canvasを条件付きでアンマウントしても、**VoxelRendererコンポーネントツリー全体**は生存し続けていた:

| リソース | 個数/タブ | 内容 |
|----------|-----------|------|
| Levaパネル | 2 | メインコントロール + Clippingコントロール |
| useControlsフック | 20+ | 各種レンダリングパラメータ |
| useMemoで生成されたThree.jsオブジェクト | 多数 | テクスチャ、パレット、カラーマップ等 |
| React仮想DOMツリー | 1 | VoxelRenderer全体のフック群 |

3つのwebviewそれぞれにThree.js・React・Levaのオブジェクトグラフが存在し、
V8のGC（ガベージコレクタ）がこれらすべてをスキャンする必要がある。
3つを超えるとGCポーズ（Mark & Sweep）がアクティブタブの描画フレームを阻害する。

モデルサイズに依存しないのは、ボトルネックがモデルデータではなく
**フレームワーク/ライブラリのオブジェクトグラフ**であるため。

## 暫定対策（現在の実装）

タブが非表示（`isActive=false`）になった際に、**VoxelRenderer全体をアンマウント**する。

```tsx
// VoxelViewer.tsx
{voxelData && isActive && (
  <VoxelRenderer ... />
)}
```

これにより隠れたwebviewのオブジェクトグラフが劇的に縮小し、GC負荷がほぼゼロになる。

### トレードオフ

| 項目 | 影響 |
|------|------|
| カメラ位置 | タブ切替時にリセットされる |
| Levaコントロール値 | タブ切替時にデフォルトに戻る |
| Clipping設定 | タブ切替時にリセットされる |
| ボクセルデータ | `voxelData` はVoxelViewer側で保持されるため影響なし |
| タブ切替速度 | Canvas再生成 + テクスチャ再アップロードの遅延あり |

## 今後の改善案

### 1. カメラ状態の永続化

Extension側にカメラ状態を保存し、VoxelRenderer再マウント時に復元する。

```
Webview → Extension: saveState({ camera: { position, target, quaternion, zoom } })
Extension → Webview: restoreState({ camera: ... })  // ready時に送信
```

### 2. Levaコントロール状態の永続化

同様にLevaの設定値をExtension側に保存・復元する。
ただし、コントロール数が多いため、保存対象の選定が必要。

### 3. retainContextWhenHidden: false への変更検討

webview自体を破棄する方式に切り替えれば、リソース問題は完全に解消される。
ただし、タブ切替時にwebviewの再作成が必要になり、初回ロード相当のコストがかかる。
現在のVoxelRenderer全体アンマウント方式でほぼ同等の効果が得られているため、優先度は低い。

### 4. VoxelRendererの軽量化

長期的には、VoxelRendererのコンポーネント構造を見直し、
非表示時に必要最小限のオブジェクトのみ保持する設計にすることで、
`retainContextWhenHidden: true` のまま状態保持とパフォーマンスを両立できる可能性がある。

## スプリット時のFPS 2倍問題

### 症状

2つのhakoviewタブをスプリットで並べた状態で片方を操作すると、操作した側のFPSが通常の約2倍になる。
新規ウィンドウへの移動では発生しない。

### 原因

Chromium/Electronの挙動: VS Codeでスプリットすると、webviewのiframeがDOM上で再配置（re-parent）される。
Chromiumはre-parentされたiframeの `requestAnimationFrame` を通常の2倍の頻度（~120Hz）で発火させることがある。

R3Fの `frameloop="demand"` ループはRAFコールバックごとに1回描画するため:
- 通常: 60Hz RAF = 60fps
- re-parent後: 120Hz RAF = 120fps（2倍）

新規ウィンドウへの移動ではiframeの再配置が行われないため、発生しない。

### 対策: RenderThrottle コンポーネント

`gl.render`（WebGL描画コール）をラップし、前回の描画からの経過時間が短すぎる場合はスキップする。

```tsx
// VoxelRenderer.tsx 内
<Canvas frameloop="demand">
  <RenderThrottle maxFps={60} />
  ...
</Canvas>
```

- R3Fのループ自体（`useFrame`コールバック含む）は通常通り動作
- TrackballControlsのダンピングアニメーションも正常動作
- `gl.render` のみスロットリング → 実効GPU描画は最大60fps
- 閾値: `1000/maxFps * 0.75 ≈ 12.5ms`（通常16.6ms RAFは通過、8.3ms RAFはスキップ）

## 関連ファイル

- `src/voxelEditor/VoxelEditorProvider.ts` — `retainContextWhenHidden` 設定、`viewStateChanged` メッセージ送信
- `webview/src/VoxelViewer.tsx` — `isVisible` による条件付きレンダリング
- `webview/src/VoxelRenderer.tsx` — Three.js/R3F/Levaのメインコンポーネント、`RenderThrottle`
- `webview/src/hooks/useExtensionMessage.ts` — `isVisible` 状態管理

## 調査時の参考情報

- R3Fのフレームループ: `node_modules/@react-three/fiber/dist/events-*.esm.js` 内の `createLoop` 関数
- R3Fのアンマウント処理: 同ファイル内の `unmountComponentAtNode` 関数（500ms遅延でforceContextLoss + dispose）
- Levaの内部ループ: ユーザー操作時のみsetInterval使用、連続的なrAFループなし
- dreiのStats: `addEffect`/`addAfterEffect` でグローバルエフェクト登録、Canvas unmount時にクリーンアップ
