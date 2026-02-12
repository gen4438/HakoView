# セットアップ完了 - Hako View

Hako View VS Code拡張機能がGitHub Releaseでの配布準備が完了しました！

## 📦 作成されたもの

### 1. VSIXパッケージ

- **場所**: `dist/hakoview.vsix` (480 KB)
- **ステータス**: 配布準備完了
- **内容**: 19個の最適化されたファイル
  - コンパイル済み拡張機能: `dist/extension.js` (12.7 KB)
  - Webviewバンドル: `webview/dist/webview.js` (1.1 MB)
  - アセット: `images/icon.png`, `icon.svg`
  - 依存関係: `package.json`, `pnpm-lock.yaml`

### 2. プロジェクト設定

- **変更されたファイル**:
  - `package.json` → リポジトリ、ライセンス、スクリプトを追加
  - `.vscodeignore` → ファイル除外を最適化
- **新規作成ファイル**:
  - `LICENSE` → MITライセンス（マーケットプレイスに必須）

### 3. GitHub ワークフロー

#### `release.yml` - GitHub Release自動作成

- **トリガー**: Gitタグ（形式: `v*.*.*`）
- **動作**:
  1. タグプッシュ時に拡張機能をビルド
  2. VSIXパッケージを作成
  3. GitHub Releaseを作成
  4. VSIXをアタッチ
  5. インストール手順を表示
- **ステータス**: 使用準備完了

#### `publish.yml` - マーケットプレイス公開

- **トリガー**: GitHub Release公開時
- **動作**:
  1. VS Code Marketplace に公開（トークン設定時）
  2. OpenVSX Registry に公開（トークン設定時）
- **ステータス**: 準備完了（GitHub Secrets設定が必要）

### 4. NPM スクリプト

```bash
# ビルドとパッケージ化
pnpm run vsix                    # VSIXを dist/ に作成

# マーケットプレイス公開（トークン必須）
pnpm run publish:marketplace     # VS Code Marketplace
pnpm run publish:openvsx         # OpenVSX Registry
pnpm run publish                 #両方に公開

# 標準ビルド/テスト
pnpm run build:prod              # 本番ビルド
pnpm run build                   # 開発ビルド
pnpm run lint                    # コードチェック
pnpm run test                    # テスト実行
```

### 5. ドキュメント

| ファイル            | 目的                                 |
| ------------------- | ------------------------------------ |
| `docs/release.md`   | 完全なリリースガイド                 |
| `docs/checklist.md` | ステップバイステップのチェックリスト |
| `docs/secrets.md`   | GitHub Secrets設定ガイド             |
| `docs/template.md`  | リリースノートテンプレート           |

## 🚀 最初のリリース手順

### ステップ1: 更新とコミット

```bash
# package.json でバージョンを更新（例: 0.0.1 → 0.1.0）
# CHANGELOG.md を更新
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.1.0"
```

### ステップ2: タグ作成とプッシュ

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin main --tags
```

### ステップ3: GitHub Actions が自動実行

- ✅ VSIXをビルド
- ✅ GitHub Release を作成
- ✅ VSIXをアタッチ
- ✅ ユーザーがダウンロード可能

### ステップ4: Release を公開（オプション - マーケットプレイス公開）

- GitHub の Releases ページに移動
- リリースノートを追加
- 「Publish release」をクリック
- `publish.yml` ワークフローが自動的にマーケットプレイスに公開

## 🔐 マーケットプレイス公開を有効化（オプション）

VS Code MarketplaceおよびOpenVSXへの自動公開を有効にするには:

1. **ガイドを確認**: `docs/secrets.md`
2. **トークンを取得**:
   - VS Code Marketplace: https://marketplace.visualstudio.com/
   - OpenVSX: https://open-vsx.org/
3. **GitHub Secrets に追加**:
   - `VSCODE_MARKETPLACE_TOKEN`
   - `OPENVSX_TOKEN`

**トークン未設定時**: VSIXはGitHub Releasesから利用可能です。

## 📋 作成/変更されたファイル

### 新規作成

```
LICENSE                                 MIT ライセンスファイル
docs/
  ├── release.md                       完全なリリースガイド
  ├── checklist.md                    チェックリスト
  ├── secrets.md                      GitHub Secrets設定ガイド
  └── template.md                     リリースノートテンプレート

.github/workflows/
  ├── release.yml                     GitHub Release 自動作成
  └── publish.yml                     マーケットプレイス公開
```

### 変更

```
package.json                           リポジトリ、ライセンス、スクリプト追加
.vscodeignore                         配布用に最適化
```

### 生成

```
dist/hakoview.vsix                     配布準備完了の拡張機能パッケージ
```

## ✨ 主な機能

✅ **自動GitHub Release** - タグプッシュ → VSIXビルド → Release作成  
✅ **マーケットプレイス公開** - 複数マーケットプレイスへワンクリック公開  
✅ **プロフェッショナル配布** - すべてのファイルが本番用に最適化  
✅ **MIT ライセンス** - 明確なライセンスを含む  
✅ **充実したドキュメント** - 様々なユースケース向けガイド  
✅ **ゼロ設定対応** - GitHub Releasesはそのまま使用可能

## 📚 ドキュメントマップ

- **とにかくリリースしたい?** → [`docs/checklist.md`](./checklist.md)
- **詳細を知りたい?** → [`docs/release.md`](./release.md)
- **トークン設定は?** → [`docs/secrets.md`](./secrets.md)
- **リリースノート形式は?** → [`docs/template.md`](./template.md)

## 🎯 次のステップ

1. ✅ [`docs/checklist.md`](./checklist.md) を確認
2. ⬜ （オプション）GitHub Secrets を設定してマーケットプレイス公開を有効化
3. ⬜ チェックリストに従って最初のリリースを作成
4. ⬜ GitHub Release ワークフローをテスト
5. ⬜ VSIXがダウンロード可能なことを確認
6. ⬜ （オプション）マーケットプレイスに公開

## 🆘 サポート

- **ワークフローが実行されない?** - `.github/workflows/` のファイルを確認
- **VSIXビルドが失敗?** - `pnpm run vsix` をローカルで実行して確認
- **公開に問題?** - `docs/secrets.md` を参照
- **その他の質問?** - `docs/release.md` のトラブルシューティングセクションを参照

---

## ✅ 準備完了！

```bash
# ローカルでビルド
pnpm run vsix

# GitHubで自動リリース作成
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin main --tags

# 完了! 🎉
```

詳細は `docs/` フォルダのドキュメントを確認してください。
