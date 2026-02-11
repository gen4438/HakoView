# hakoview README

このドキュメントは拡張機能「hakoview」のREADMEです。概要の記載後、以下の章を埋めてください。

## Features

- .leSファイルを既定でボクセルビューアーとして開きます
- テキストエディタから「Open in Voxel Viewer」で切り替え可能
- コマンドパレットから空のビューアーを開き、D&Dで読み込み

使い方:

1. エクスプローラーで .leS を開く
2. またはコマンドパレットで「Hakoview: Open Voxel Viewer」を実行
3. 空のビューアーに .leS をドラッグ&ドロップ

## Requirements

- VS Code 1.109.0 以上
- WebGL2が利用できる環境

## Extension Settings

`contributes.configuration` を通じてVS Code設定を追加する場合はここに記載します。

例:

この拡張機能は次の設定を追加します:

- `myExtension.enable`: 拡張機能の有効/無効を切り替えます。
- `myExtension.thing`: `blah` に設定すると特定の動作を行います。

## Known Issues

現在、重大な既知不具合はありません。

## Release Notes

更新時にはリリースノートを用意してください。

### 1.0.0

初回リリース。

### 1.0.1

Issue # の修正。

### 1.1.0

機能X、Y、Zを追加。

---

## 拡張機能ガイドラインの遵守

拡張機能ガイドラインを確認し、推奨ベストプラクティスに従ってください。

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Markdownの利用

READMEはVS Codeで編集できます。便利なショートカット:

- エディタ分割（macOS: `Cmd+\` / Windows・Linux: `Ctrl+\`）
- プレビュー切替（macOS: `Shift+Cmd+V` / Windows・Linux: `Shift+Ctrl+V`）
- スニペット表示（Windows・Linux・macOS: `Ctrl+Space`）

## 参考情報

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
