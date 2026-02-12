# クイックスタートガイド: leSボクセルビューアー実装

**Feature**: 001-les-voxel-viewer  
**Date**: 2026-02-12  
**対象**: 開発者

このドキュメントは、leSボクセルビューアーの実装を開始するための手順とチェックリストを提供します。

---

## 前提条件

### 開発環境

- **Node.js**: 18.x 以上
- **pnpm**: 8.x 以上（既存プロジェクトで使用中）
- **VS Code**: 1.109.0 以上
- **TypeScript**: 5.9.3（既存）
- **OS**: Linux / macOS / Windows

### 既存プロジェクト構成

```
hakoview/
├── src/
│   ├── extension.ts          # ✓ 既存
│   └── test/                 # ✓ 既存
├── package.json              # ✓ 既存
├── tsconfig.json             # ✓ 既存
├── esbuild.js                # ✓ 既存
└── tmp/                      # ✓ 参考実装あり
    ├── VoxelRenderer.tsx
    ├── voxel.vert
    └── voxel.frag
```

---

## Phase 1: プロジェクト構造のセットアップ

### 1.1 ディレクトリ作成

```bash
# Extension側
mkdir -p src/voxelEditor
mkdir -p src/voxelParser
mkdir -p src/commands

# Webview側
mkdir -p webview/src/{components,hooks,shaders,types}
mkdir -p webview/dist
```

### 1.2 Webview用package.json作成

```bash
cd webview
pnpm init
```

**webview/package.json**:

```json
{
  "name": "hakoview-webview",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "node ../esbuild.webview.js",
    "watch": "node ../esbuild.webview.js --watch"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "three": "^0.160.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.92.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/three": "^0.160.0"
  }
}
```

### 1.3 依存関係のインストール

```bash
# Webview
cd webview
pnpm install

# ルート（既存）
cd ..
# 必要に応じて追加パッケージをインストール
```

---

## Phase 2: Extension側の実装

### 2.1 VoxelDataモデルの実装

**`src/voxelParser/VoxelData.ts`**:

```typescript
export interface Dimensions {
  x: number;
  y: number;
  z: number;
}

export interface VoxelDataset {
  dimensions: Dimensions;
  voxelLength: number;
  values: Uint8Array;
  fileName: string;
  filePath?: string;
}
```

**実装チェックリスト**:

- [ ] Dimensions インターフェース定義
- [ ] VoxelDataset インターフェース定義
- [ ] getVoxelIndex ヘルパー関数
- [ ] getVoxelValue ヘルパー関数

### 2.2 .leSパーサーの実装

**`src/voxelParser/LesParser.ts`**:

```typescript
export class LesParser {
  static parse(content: Uint8Array): VoxelDataset {
    // 1. テキストデコード
    const text = new TextDecoder().decode(content);

    // 2. ヘッダパース
    const lines = text.split('\n');
    const header = this.parseHeader(lines[0]);

    // 3. データパース
    const values = this.parseData(lines.slice(1), header);

    // 4. バリデーション
    this.validate(header, values);

    return { ...header, values };
  }

  private static parseHeader(line: string): HeaderInfo {
    /* ... */
  }
  private static parseData(lines: string[], header: HeaderInfo): Uint8Array {
    /* ... */
  }
  private static validate(header: HeaderInfo, values: Uint8Array): void {
    /* ... */
  }
}
```

**実装チェックリスト**:

- [ ] ヘッダパース（X Y Z [voxelLength]）
- [ ] データパース（X\*Y行、各Z値）
- [ ] バリデーション（FR-005, FR-008, FR-011）
- [ ] エラーハンドリング（ParseError定義）
- [ ] ユニットテスト（`src/test/voxelParser/LesParser.test.ts`）

### 2.3 CustomEditorProviderの実装

**`src/voxelEditor/VoxelEditorProvider.ts`**:

```typescript
export class VoxelEditorProvider implements vscode.CustomEditorProvider<VoxelDocument> {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new VoxelEditorProvider(context);
    return vscode.window.registerCustomEditorProvider('hakoview.lesViewer', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    });
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Promise<VoxelDocument> {
    // ファイルまたはバックアップから読み込み
    const data = await this.readFile(uri, openContext);
    return new VoxelDocument(uri, data);
  }

  async resolveCustomEditor(
    document: VoxelDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    // Webviewセットアップ
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // メッセージハンドリング
    this.setupMessageHandling(document, webviewPanel);

    // 初期データ送信
    this.sendVoxelData(document, webviewPanel);
  }
}
```

**実装チェックリスト**:

- [ ] CustomEditorProvider実装
- [ ] VoxelDocument実装（CustomDocument）
- [ ] openCustomDocument（ファイル読み込み）
- [ ] resolveCustomEditor（Webview構築）
- [ ] メッセージハンドリング（contracts/に基づく）
- [ ] backupCustomDocument（Hot Exit対応）
- [ ] saveCustomDocument（将来の編集機能用）

### 2.4 package.json設定

**`package.json`の更新**:

```json
{
  "contributes": {
    "customEditors": [
      {
        "viewType": "hakoview.lesViewer",
        "displayName": "LES Voxel Viewer",
        "selector": [
          {
            "filenamePattern": "*.leS"
          }
        ],
        "priority": "default"
      }
    ],
    "commands": [
      {
        "command": "hakoview.openVoxelViewer",
        "title": "Open Voxel Viewer",
        "category": "Hakoview"
      },
      {
        "command": "hakoview.openFromEditor",
        "title": "Open in Voxel Viewer",
        "category": "Hakoview"
      },
      {
        "command": "hakoview.openAsText",
        "title": "Reopen as Text",
        "category": "Hakoview"
      }
    ],
    "menus": {
      "editor/title": [
        {
          "command": "hakoview.openFromEditor",
          "when": "resourceExtname == .leS",
          "group": "navigation"
        }
      ]
    }
  }
}
```

---

## Phase 3: Webview側の実装

### 3.1 React + Three.js基盤

**`webview/src/index.tsx`**:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { VoxelViewer } from './VoxelViewer';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<VoxelViewer />);
```

**`webview/src/VoxelViewer.tsx`**:

```tsx
import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { VoxelRenderer } from './VoxelRenderer';
import { useExtensionMessage } from './hooks/useExtensionMessage';

export const VoxelViewer: React.FC = () => {
  const { voxelData, sendMessage } = useExtensionMessage();

  useEffect(() => {
    sendMessage({ command: 'ready' });
  }, []);

  if (!voxelData) {
    return <div>Drop .leS file here</div>;
  }

  return (
    <Canvas>
      <OrbitControls />
      <Stats />
      <VoxelRenderer data={voxelData} />
    </Canvas>
  );
};
```

**実装チェックリスト**:

- [ ] React + ReactDOM セットアップ
- [ ] Canvas（@react-three/fiber）
- [ ] OrbitControls
- [ ] useExtensionMessage フック
- [ ] ドラッグ&ドロップハンドラ

### 3.2 VoxelRenderer実装

**`webview/src/VoxelRenderer.tsx`**:
tmpフォルダの既存実装を移植・整理。

```tsx
// tmp/VoxelRenderer.tsx から移植
export const VoxelRenderer: React.FC<{ data: VoxelDataset }> = ({ data }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { dataTexture, paletteTexture } = useMemo(() => createTextures(data), [data]);

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[data.dimensions.x, data.dimensions.y, data.dimensions.z]} />
      <voxelShaderMaterial
        uTexture={dataTexture}
        uPaletteTexture={paletteTexture}
        uVoxelShape={[data.dimensions.x, data.dimensions.y, data.dimensions.z]}
      />
    </mesh>
  );
};
```

**実装チェックリスト**:

- [ ] VoxelRenderer コンポーネント
- [ ] Data3DTexture 生成
- [ ] PaletteTexture 生成
- [ ] カスタムシェーダーマテリアル統合
- [ ] tmp/ からシェーダーファイル移植
- [ ] パフォーマンス最適化（useMemo, useCallback）

### 3.3 シェーダー移植

**`webview/src/shaders/voxel.vert`**:

```glsl
// tmp/voxel.vert から移植
precision highp float;

uniform vec3 uVoxelShape;

varying vec3 vOrigin;
varying vec3 vDirection;
varying vec3 vModelPosition;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;
    vOrigin = cameraPosition;
    vDirection = modelPosition.xyz - vOrigin;
    vModelPosition = modelPosition.xyz;
}
```

**`webview/src/shaders/voxel.frag`**:

```glsl
// tmp/voxel.frag から移植（簡略版）
precision highp float;
precision highp sampler3D;

uniform vec3 uVoxelShape;
uniform sampler3D uTexture;
uniform sampler2D uPaletteTexture;

varying vec3 vOrigin;
varying vec3 vDirection;

void main() {
    // DDAレイマーチング実装
    // ...
}
```

**実装チェックリスト**:

- [ ] voxel.vert 移植
- [ ] voxel.frag 移植（基本版）
- [ ] シェーダーマテリアル定義（shaderMaterial from drei）
- [ ] Uniformsバインディング
- [ ] CSP対応（インライン埋め込み）

### 3.4 Webview HTML生成

**Extension側（`src/voxelEditor/VoxelEditorProvider.ts`）**:

```typescript
private getHtmlForWebview(webview: vscode.Webview): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist', 'webview.js')
  );

  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist', 'webview.css')
  );

  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   script-src ${webview.cspSource};
                   style-src ${webview.cspSource} 'unsafe-inline';
                   img-src ${webview.cspSource} data:;
                   worker-src blob:;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>Voxel Viewer</title>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
```

---

## Phase 4: ビルド設定

### 4.1 esbuild設定（Webview用）

**`esbuild.webview.js`**:

```javascript
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['webview/src/index.tsx'],
    bundle: true,
    outfile: 'webview/dist/webview.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: production,
    sourcemap: !production,
    loader: {
      '.vert': 'text',
      '.frag': 'text',
    },
    define: {
      'process.env.NODE_ENV': production ? '"production"' : '"development"',
    },
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### 4.2 tsconfig（Webview用）

**`webview/tsconfig.json`**:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*"]
}
```

### 4.3 package.jsonスクリプト更新

**ルート `package.json`**:

```json
{
  "scripts": {
    "compile": "pnpm run check-types && pnpm run lint && node esbuild.js && node esbuild.webview.js",
    "watch": "npm-run-all -p watch:*",
    "watch:esbuild": "node esbuild.js --watch",
    "watch:webview": "node esbuild.webview.js --watch",
    "watch:tsc": "tsc --noEmit --watch --project tsconfig.json"
  }
}
```

---

## Phase 5: テスト実装

### 5.1 ユニットテスト

**`src/test/voxelParser/LesParser.test.ts`**:

```typescript
import * as assert from 'assert';
import { LesParser } from '../../voxelParser/LesParser';

suite('LesParser Test Suite', () => {
  test('Parse valid .leS file', () => {
    const content = new TextEncoder().encode(
      '2 3 4 1.0e-9\n' +
        '1 0 0 0\n' +
        '0 0 0 0\n' +
        '0 0 0 0\n' +
        '0 0 10 0\n' +
        '0 0 0 0\n' +
        '0 0 0 0\n'
    );

    const dataset = LesParser.parse(content);

    assert.strictEqual(dataset.dimensions.x, 2);
    assert.strictEqual(dataset.dimensions.y, 3);
    assert.strictEqual(dataset.dimensions.z, 4);
    assert.strictEqual(dataset.values.length, 24);
    assert.strictEqual(dataset.values[0], 1);
  });

  test('Reject oversized voxel grid', () => {
    const content = new TextEncoder().encode('1001 1001 1001 1.0e-9\n...');
    assert.throws(() => LesParser.parse(content), /exceeds limit/);
  });
});
```

### 5.2 統合テスト

**`src/test/integration/voxelEditor.test.ts`**:

```typescript
import * as vscode from 'vscode';
import * as assert from 'assert';

suite('Voxel Editor Integration Test', () => {
  test('Open .leS file in custom editor', async () => {
    const uri = vscode.Uri.file('/path/to/test.leS');
    await vscode.commands.executeCommand('vscode.openWith', uri, 'hakoview.lesViewer');

    // CustomEditorが開いていることを確認
    // （実際のアサーション実装は複雑）
  });
});
```

---

## Phase 6: デバッグとテスト

### 6.1 開発モードで実行

```bash
# ビルド
pnpm run compile

# VS Codeデバッグ
# F5キーを押して拡張機能ホストを起動
```

### 6.2 テスト実行

```bash
pnpm run test
```

### 6.3 手動テスト

1. tmp/内の.leSファイルをワークスペースにコピー
2. ファイルツリーから.leSを開く → ビューアーが起動
3. コマンドパレット → "Hakoview: Open Voxel Viewer" → 空のビューアー
4. .leSファイルをドラッグ&ドロップ → 表示更新

---

## チェックリスト全体

### Extension側

- [ ] VoxelData モデル定義
- [ ] LesParser 実装
- [ ] CustomEditorProvider 実装
- [ ] VoxelDocument 実装
- [ ] メッセージングハンドラ
- [ ] コマンド登録（3つ）
- [ ] package.json更新
- [ ] ユニットテスト
- [ ] 統合テスト

### Webview側

- [ ] React + ReactDOM セットアップ
- [ ] VoxelViewer コンポーネント
- [ ] VoxelRenderer コンポーネント
- [ ] useExtensionMessage フック
- [ ] シェーダー移植（voxel.vert, voxel.frag）
- [ ] Data3DTexture生成
- [ ] PaletteTexture生成
- [ ] ドラッグ&ドロップ
- [ ] CSP対応
- [ ] ビルド設定

### ビルド・環境

- [ ] esbuild.webview.js 作成
- [ ] webview/tsconfig.json 作成
- [ ] package.jsonスクリプト更新
- [ ] 依存関係インストール
- [ ] .gitignore更新（webview/dist/追加）

### ドキュメント

- [ ] README.md更新（使い方の説明）
- [ ] CHANGELOG.md更新
- [ ] 日本語ドキュメント整備

---

## 実装順序の推奨

1. **Extension側基盤**（1-2日）
   - VoxelData, LesParser実装
   - ユニットテスト

2. **CustomEditor基盤**（2-3日）
   - VoxelEditorProvider基本実装
   - package.json設定
   - HTML生成

3. **Webview基盤**（2-3日）
   - React + Three.js セットアップ
   - 基本的な Canvas表示
   - メッセージング

4. **レンダリング実装**（3-5日）
   - シェーダー移植
   - VoxelRenderer実装
   - パフォーマンス最適化

5. **統合とテスト**（2-3日）
   - 3つの導線テスト
   - エラーハンドリング
   - ドキュメント整備

**合計**: 10-16日（約2-3週間）

---

## トラブルシューティング

### WebGL2が使えない

→ VS Code 1.60以降を使用していることを確認

### シェーダーがロードできない

→ CSP設定を確認、シェーダーをインライン埋め込みに変更

### Three.jsのバンドルサイズが大きい

→ Tree shakingが効いていることを確認（named import使用）

### Webviewが真っ白

→ ブラウザのコンソールでエラーを確認、CSP違反がないかチェック

---

## 検証チェックリスト

- [ ] .leSをファイルツリーから開いて描画される
- [ ] テキストエディタから「Open in Voxel Viewer」で切り替えられる
- [ ] コマンドパレットから空のビューアーを開ける
- [ ] 空のビューアーにD&Dで .leS を読み込める
- [ ] パースエラー時にエラーメッセージが表示される
- [ ] 200^3 で初回描画が5秒以内（目安）

---

## 次のステップ

Phase 1完了後：

- **Phase 2**: 階層的最適化（Occupancy Texture）
- **Phase 3**: プログレッシブレンダリング
- **Phase 4**: 編集機能（ボクセル値変更）

---

## 参考資料

- [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [React Three Fiber Documentation](https://docs.pmnd.rs/react-three-fiber/)
- [Three.js Data3DTexture](https://threejs.org/docs/#api/en/textures/Data3DTexture)
- 本プロジェクト: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

---

このガイドに従うことで、leSボクセルビューアーの基本実装を完了し、User Story 1-3の要件を満たすことができます。
