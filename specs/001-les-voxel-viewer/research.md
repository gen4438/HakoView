# 実装調査レポート: leSボクセルビューアー

**Feature**: 001-les-voxel-viewer  
**Date**: 2026-02-12  
**Status**: Phase 0 完了

このドキュメントは、Technical Contextの"NEEDS CLARIFICATION"項目を解決するための調査結果をまとめたものです。

---

## 1. VS Code Custom Editor API実装パターン

### Decision
**CustomEditorProvider**を採用し、.leSファイルをバイナリドキュメントとして管理する。

### Rationale
- .leSはバイナリ形式のため、CustomTextEditorProvider（テキスト専用）は不適切
- CustomReadonlyEditorProviderは読み取り専用で、将来の編集機能追加に対応不可
- CustomEditorProviderは完全な制御が可能で、保存・バックアップ・Undo/Redoを実装できる
- 将来的なボクセル編集機能（値の変更、追加、削除）に対応可能

### Alternatives Considered
- **CustomReadonlyEditorProvider**: 実装が簡単だが、拡張性に欠ける
- **CustomTextEditorProvider + JSON変換**: パフォーマンス問題とファイル形式との不一致
- **WebviewPanel直接使用**: Custom Editorの統合機能（ファイル関連付け、保存処理など）が使えない

### Implementation Notes

**package.json設定:**
```json
{
  "customEditors": [{
    "viewType": "hakoview.lesViewer",
    "displayName": "LES Voxel Viewer",
    "selector": [{ "filenamePattern": "*.leS" }],
    "priority": "default"
  }]
}
```

**既定エディタとテキストエディタの切り替え:**
- `priority: "default"`で.leSファイルを既定でビューアーで開く
- ユーザーは右クリック → "Reopen Editor With..." → "Text Editor"でテキスト表示に切り替え可能
- 標準的なVS Code UIパターンを活用

**ドキュメントライフサイクル:**
- `openCustomDocument()`: ファイルまたはバックアップからドキュメント作成
- `resolveCustomEditor()`: Webviewを構築し、ドキュメントと関連付け
- `saveCustomDocument()`: 編集内容をファイルに書き込み
- `backupCustomDocument()`: Hot Exit用の自動バックアップ（1秒後トリガー）

---

## 2. Extension-Webview通信パターン

### Decision
**双方向postMessage + Request/Responseパターン**を組み合わせる。

### Rationale
- VS Code公式パターンで、安全かつ効率的
- ArrayBuffer転送（VS Code 1.57+）で大容量ボクセルデータを効率的に送信
- Request/Response パターンでWebviewから同期的にデータ要求が可能

### Implementation Pattern

**Extension → Webview（一方向）:**
```typescript
webviewPanel.webview.postMessage({ 
  type: 'loadVoxelData',
  data: arrayBuffer  // ArrayBuffer直接転送可能
});
```

**Webview → Extension（一方向）:**
```javascript
const vscode = acquireVsCodeApi();
vscode.postMessage({ 
  command: 'requestData',
  params: {...}
});
```

**Request/Response（同期的）:**
```typescript
// Extension側
private _requestId = 1;
private _callbacks = new Map<number, (response: any) => void>();

postMessageWithResponse<R>(type: string, body: any): Promise<R> {
  const requestId = this._requestId++;
  return new Promise<R>(resolve => {
    this._callbacks.set(requestId, resolve);
    webview.postMessage({ type, requestId, body });
  });
}

// Webview側
vscode.postMessage({ 
  type: 'response', 
  requestId: originalMessage.requestId, 
  body: result 
});
```

**状態の永続化:**
```javascript
// Webviewリロード時に状態を復元
vscode.setState({ cameraPosition, zoom, settings });
const state = vscode.getState();
```

---

## 3. コマンドパレットから空のビューアーを開く

### Decision
**独立したWebviewPanel**を作成し、ドラッグ&ドロップでファイルをロード。

### Rationale
- CustomEditorはファイルベースだが、WebviewPanelの直接作成で空のビューアーを実装可能
- Pattern 1（独立WebviewPanel）とPattern 2（Untitledドキュメントベース）のうち、シンプルなPattern 1を採用
- 将来的に保存機能を追加する場合は、Untitledドキュメントへの移行を検討

### Implementation
```typescript
vscode.commands.registerCommand('hakoview.openEmptyViewer', () => {
  const panel = vscode.window.createWebviewPanel(
    'hakoview.viewer',
    'New Voxel Scene',
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: false }
  );
  
  panel.webview.html = getWebviewContent(panel.webview, null);
  setupMessageHandling(panel);
});
```

---

## 4. Webviewでのドラッグ&ドロップ実装

### Decision
**HTML5 Drag & Drop API + FileReader**を使用し、Webview内で.leSファイルを受け入れる。

### Rationale
- Webview内では標準HTML5 APIが使用可能
- ユーザー体験が直感的
- ファイルシステムアクセス不要（セキュリティ上安全）

### Implementation Pattern

**Webview側（React）:**
```javascript
const handleDrop = async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  
  if (!file.name.endsWith('.leS')) {
    vscode.postMessage({ command: 'error', message: 'Please drop a .leS file' });
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const arrayBuffer = event.target.result;
    vscode.postMessage({
      command: 'loadFile',
      fileName: file.name,
      data: Array.from(new Uint8Array(arrayBuffer))
    });
  };
  reader.readAsArrayBuffer(file);
};
```

**Extension側:**
```typescript
case 'loadFile':
  const data = new Uint8Array(message.data);
  // ビューアーを更新
  webviewPanel.webview.postMessage({
    type: 'updateVoxelData',
    data: data
  });
  break;
```

---

## 5. React Three Fiber のパッケージング

### Decision
**React Three Fiber + Three.js**を採用し、esbuildでバンドリング。

### Rationale
- tmp/VoxelRenderer.tsxで既に実装済みで、動作実績がある
- 宣言的なReactパターンで、状態管理とUIロジックが整理しやすい
- Three.jsの低レベルAPI直接使用と比較して、コード量が少なく保守性が高い
- VS Code Webview環境でWebGLは標準サポート

### Primary Dependencies
- `react` (18.x+): UI基盤
- `react-dom` (18.x+): DOM レンダリング
- `three` (0.150.0+): WebGL/3Dレンダリング
- `@react-three/fiber` (8.x+): React用Three.jsレンダラー
- `@react-three/drei` (9.x+): Three.js便利コンポーネント（OrbitControls, Stats等）

### Optional Dependencies
- `leva` (0.9.x+): デバッグUI（開発時のみ、production excludeを検討）
- `react-use` (17.x+): カスタムフック集（`useWindowSize`等、必要なものだけ抽出可）

### Build Configuration
```javascript
// esbuild.config.js (webview用)
{
  entryPoints: ['webview/src/index.tsx'],
  bundle: true,
  outfile: 'webview/dist/webview.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  sourcemap: 'inline',
  external: [], // すべてバンドル
  define: {
    'process.env.NODE_ENV': '"production"'
  }
}
```

### Bundle Size 最適化
- Tree shakingで未使用コードを除去
- Three.jsから必要なモジュールのみimport
- Leva は開発ビルドのみ含める
- 目標バンドルサイズ: <2MB (gzip圧縮後 <500KB)

### Alternatives Considered
- **Three.js直接使用**: 低レベルで制御は細かいが、コード量が増加
- **Babylon.js**: 高機能だがバンドルサイズが大きい（5-10MB）
- **A-Frame**: VR向けで、ボクセルビューアーには過剰

### CSP (Content Security Policy) 対応
Webview環境では厳格なCSPが適用されるため：
```typescript
// Extension側でCSPを設定
const csp = `
  default-src 'none';
  script-src ${webview.cspSource};
  style-src ${webview.cspSource} 'unsafe-inline';
  img-src ${webview.cspSource} data:;
  connect-src ${webview.cspSource};
  worker-src blob:;
`;
```
- シェーダー文字列は直接コード内に埋め込み（外部ロード不可）
- インラインスタイルは必要最小限に

---

## 6. 大規模ボクセルレンダリング最適化

### Decision
**効率的なレイマーチング + プログレッシブレンダリング**を採用。既存のDDAベースシェーダーを最適化。

### Rationale
- 既存のtmp/voxel.vert、tmp/voxel.fragが堅実なDDAレイマーチング実装
- Three.js Data Texture (R8フォーマット) でメモリ効率が良い
- **密なボクセルデータが基本**のため、空領域スキップよりレイマーチング効率とメモリ転送が重要
- 200³で<5秒、1024³で実用的な性能を達成可能

### 既存実装の評価
**現状:**
- レイマーチング（DDAアルゴリズム）
- R8インデックステクスチャ（1バイト/ボクセル）+ 16色パレット
- 距離ベースのステップ数削減（遠距離で25%）
- 既存のOccupancy Texture実装があるが、密データでは効果限定的

**メモリ使用量:**
- 200³: 8MB（テクスチャ）
- 1024³: 953MB（テクスチャ）
- 上限1GB以内で許容範囲

**密データでのボトルネック:**
1. **CPUパース**: テキスト→Uint8Array変換が最大の障壁
2. **GPU転送**: 大容量データの転送時間
3. **レイマーチング**: 密データでは全ボクセルを走査する必要がある

### Optimization Strategies（優先度順）

#### Phase 1: 基盤整備（MVP）
1. **Web Worker ローダー** - メインスレッドブロック回避、パース並列化
2. **プログレッシブレンダリング** - 低解像度プレビュー（1/8³サンプリング）即座表示
3. **レイマーチング基本最適化** - ステップ数調整、境界条件チェック

**重点**: CPUボトルネック解消とユーザー体験向上

#### Phase 2: レンダリング効率化（200³で<3秒）
4. **距離ベース最適化強化** - 遠距離でのサンプリング粒度調整（密データでも有効）
5. **Early Ray終了の改善** - ビューポート外、背面カリング
6. **テクスチャフィルタリング最適化** - NearestFilterの効率的な実装

**重点**: GPU効率とフレームレート向上

#### Phase 3: 大規模対応（1024³で実用的）
7. **プログレッシブテクスチャアップロード** - GPU転送を段階的に実行
8. **メモリプール管理** - テクスチャの再利用、メモリリーク防止
9. **ストリーミングパース** - ファイルを段階的に読み込み・解析

**重点**: メモリ効率と大規模データ対応

#### Phase 4: 先進的最適化（オプション）
10. **LOD mipmap** - 距離別に低解像度テクスチャ切替
11. **3D Tiling** - 超大規模データ（2000³以上）向け
12. **Occupancy Texture** - 疎データが多い場合のみ実装を検討

**判断**: Occupancy Textureは密データでは効果が薄いため、Phase 4で疎データ対応時に検討

### 期待効果（密データを想定）

- **Web Worker**: パース時間30-50%短縮、UI応答性維持
- **プログレッシブレンダリング**: 体感待機時間70-80%短縮（即座にプレビュー）
- **距離ベース最適化**: 遠距離描画で40-50%高速化（ズームアウト時）
- **プログレッシブアップロード**: GPU転送の体感時間60-70%短縮

**総合**: 
- **200³**: パース2秒 + 初回描画1秒 = 計3秒達成可能
- **1024³**: パース8-10秒 + プログレッシブ表示2-3秒 = 計10-13秒（目標15秒以内）
- **操作時FPS**: 200³で30fps以上、1024³で20fps以上

### 密データ vs 疎データの考慮

**密データ（80%以上がvalue>0）の場合:**
- Occupancy Textureの効果: 5-15%程度（実装コスト見合わず）
- 重要な最適化: メモリ転送、レイマーチング効率、距離ベースLOD

**疎データ（50%以下がvalue>0）の場合:**
- Occupancy Textureの効果: 40-60%（Phase 4で実装を検討）
- MVPは密データを想定し、疎データ対応は将来拡張

### Alternatives Considered
- **ポリゴンメッシュ変換（Marching Cubes）**: 前処理コスト大、メモリ爆発
- **点群レンダリング**: 視覚品質低下
- **GPU Instancing**: スケールしない（密データで1億個以上のインスタンス）
- **WebGPU**: ブラウザ対応が限定的（Phase 4以降で検討）
- **Occupancy Texture優先**: 密データでは効果薄い（Phase 4に後回し）

---

## 7. パフォーマンス測定方法

### Decision
**複数段階の計測 + 自動ベンチマーク**を実装。

### Measurement Framework

```typescript
interface VoxelRenderingMetrics {
  // ロード段階
  loadMetrics: {
    fetchTime: number;          // ネットワーク取得
    parseTime: number;          // leSパース
    textureUploadTime: number;  // GPU転送
  };
  
  // 描画性能
  renderMetrics: {
    timeToFirstFrame: number;   // 初回描画開始（主要指標）
    fps: number;                // 平均FPS
    frameTime: number;          // フレーム時間（ms）
    worstFrameTime: number;     // 最悪フレーム時間
  };
  
  // リソース使用
  resourceMetrics: {
    cpuMemoryMB: number;        // CPU RAM
    gpuMemoryMB: number;        // VRAM（推定）
    textureCount: number;       // テクスチャ数
  };
}
```

### 計測方法

**A. 初回描画時間（Primary Metric）:**
```javascript
const t0 = performance.now();
await loadLeSFile(url);
await waitForFirstFrame();
const t1 = performance.now();
// 目標: 200³で<5000ms
```

**B. FPS計測:**
```tsx
// React Three Fiber <Stats />コンポーネント使用
import { Stats } from '@react-three/drei';

<Canvas>
  <Stats />
  {/* ... */}
</Canvas>
// 目標: 200³で>30fps、1024³で>20fps
```

**C. メモリ使用量:**
```javascript
const memory = performance.memory;
console.log('JS Heap:', memory.usedJSHeapSize / 1024 / 1024, 'MB');
```

### Benchmark Suite
- `benchmark_200x200x200_dense.leS` - 密データ
- `benchmark_200x200x200_sparse.leS` - 疎データ（30%空）
- `benchmark_1024x1024x1024_sparse.leS` - 大規模疎データ

### 測定環境
- **標準PC**: Intel i5-8世代以上、16GB RAM、統合GPU
- **高性能PC**: Intel i7-10世代以上、32GB RAM、専用GPU
- **ブラウザ**: Chrome/Edge (WebGL2必須)

### 自動化
- E2Eテスト内でパフォーマンス計測
- CI/CDでリグレッション検出（基準値との比較）
- 複数データセットでベンチマーク実行

---

## 8. Project Structure 決定

### Decision
**VS Code Extension（Extension Host + Webview）の分離構造**。

### Structure
```text
src/                          # Extension Host側（Node.js）
├── extension.ts                  # エントリポイント
├── voxelEditor/                  # Custom Editor実装
├── voxelParser/                  # .leSパーサー
└── commands/                     # コマンド実装

webview/                      # Webview UI側（Browser）
├── src/
│   ├── index.tsx                 # エントリポイント
│   ├── VoxelViewer.tsx           # メインコンポーネント
│   ├── VoxelRenderer.tsx         # Three.js（tmpから移植）
│   └── shaders/                  # シェーダー（tmpから移植）
├── dist/                         # ビルド出力
├── package.json                  # Webview専用依存関係
└── tsconfig.json                 # Webview用設定
```

### Rationale
- Extension HostとWebviewで異なるビルドパイプライン
- Webviewは独立したReactアプリケーションとして管理
- 既存のtmp/実装を整理して移植

---

## まとめ

すべてのNEEDS CLARIFICATIONが解決されました：

| 項目 | 決定事項 | 根拠 |
|------|---------|------|
| Primary Dependencies | React Three Fiber + Three.js | 既存実装の移植、宣言的パターン |
| Custom Editor方式 | CustomEditorProvider | バイナリファイル、将来の編集機能対応 |
| 通信パターン | postMessage + Request/Response | 公式パターン、効率的 |
| レンダリング手法 | 階層的レイマーチング | 既存DDA拡張、性能目標達成可能 |
| パフォーマンス測定 | 複数段階計測 + 自動ベンチマーク | リグレッション検出、CI/CD統合 |

次のPhase 1（設計フェーズ）で、data-model.md、contracts/、quickstart.mdを生成します。
