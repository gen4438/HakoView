# リリースガイド - Hako View

このガイドでは、Hako View拡張機能のリリースと配布方法について説明します。

## クイックスタート

### ローカルでのVSIXパッケージ作成

1. **VSIXパッケージをビルド:**

   ```bash
   pnpm run vsix
   ```

   プロジェクトの `dist/` フォルダに `hakoview.vsix` が作成されます。

2. **VS Codeにローカルインストール:**
   - VS Codeを開く
   - 拡張機能を開く（Ctrl+Shift+X / Cmd+Shift+X）
   - 「...」メニュー → 「VSIXからのインストール...」をクリック
   - `dist/hakoview.vsix` ファイルを選択

### 自動GitHubリリース

プロジェクトには自動的にリリースを作成し、マーケットプレイスに公開するワークフローが含まれています。

#### ステップ1: バージョン更新

`package.json` でバージョンを更新します:

```json
{
  "version": "0.1.0"
}
```

#### ステップ2: コミットとタグ作成

```bash
# 変更をコミット
git add package.json
git commit -m "chore: bump version to 0.1.0"

# Gitタグを作成
git tag -a v0.1.0 -m "Release version 0.1.0"

# GitHubにプッシュ
git push origin main --tags
```

#### ステップ3: 自動リリース作成

`release.yml` ワークフローにより自動的に:

1. 拡張機能をビルド
2. VSIXをパッケージ化
3. GitHub Releaseを作成
4. VSIXをアタッチ
5. インストール手順を表示

### マーケットプレイスへの公開

VS Code Marketplace および OpenVSX Registry に自動的に公開するには:

#### セットアップ（1回限り）

1. **VS Code Marketplace:**
   - https://marketplace.visualstudio.com/ でアカウント作成
   - 個人用アクセストークン（PAT）を生成
   - GitHub Secrets に `VSCODE_MARKETPLACE_TOKEN` として追加

2. **OpenVSX Registry:**
   - https://open-vsx.org/ でアカウント作成
   - APIトークンを生成
   - GitHub Secrets に `OPENVSX_TOKEN` として追加

詳細は [secrets.md](./secrets.md) を参照してください。

#### 公開手順

1. Gitタグをプッシュ
2. `release.yml` ワークフローでGitHub Releaseを作成
3. releaseを公開（Publishボタン）
4. `publish.yml` ワークフローが自動的にマーケットプレイスに公開

### 手動での公開

必要に応じて手動で公開できます:

```bash
# VS Code Marketplaceに公開
pnpm run publish:marketplace -- --pat YOUR_MARKETPLACE_TOKEN

# OpenVSXに公開
pnpm run publish:openvsx -- --pat YOUR_OPENVSX_TOKEN

# 両方に公開（環境変数でトークンを設定している場合）
pnpm run publish
```

## VSIXに含まれるファイル

`.vscodeignore` ファイルでVSIXに含めるファイルを制御しています。現在除外されるもの:

- TypeScriptソースファイル（dist/にコンパイル済み）
- Node modules（dist/にバンドル済み）
- 開発用ファイル（.github, .husky, specs等）
- 設定ファイル（tsconfig, eslint, prettier等）

VSIXに含まれるもの:

- コンパイル済み拡張機能コード（`dist/extension.js`）
- Webviewバンドルコード（`webview/dist/webview.js`）
- アセットファイル（`images/`）
- パッケージファイル（`package.json`, `pnpm-lock.yaml`）

## バージョン番号

[セマンティック バージョニング](https://semver.org/ja/)に従います:

- MAJOR: 破壊的変更
- MINOR: 新機能（後方互換）
- PATCH: バグ修正

例: `v1.2.3`

## リリースチェックリスト

- [ ] `package.json` でバージョンを更新
- [ ] `CHANGELOG.md` で変更内容を記述
- [ ] `pnpm run lint` と `pnpm run test` を実行
- [ ] バージョンアップをコミット
- [ ] Gitタグを作成: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
- [ ] main とタグをプッシュ: `git push origin main --tags`
- [ ] GitHub Actions が完了するまで待機
- [ ] GitHubで作成されたリリースを確認
- [ ] Releaseを公開（マーケットプレイス公開をトリガー）

## トラブルシューティング

### VSIXパッケージが失敗する

- `.vscodeignore` の問題のあるパターンを確認
- `pnpm run build:prod` を実行してビルドが成功することを確認
- node_modules内のシンボリックリンクを確認（pnpmはシンボリックリンクを使用）

### マーケットプレイス公開が失敗する

- 個人用アクセストークンがGitHub Secretsに正しく設定されていることを確認
- トークンの有効期限を確認
- マーケットプレイスアカウントで拡張機能の表示名と発行者IDが一致していることを確認

### ファイルサイズの問題

- VSIXは マーケットプレイスへのアップロード時に100MB未満である必要があります
- WebviewのJavaScriptバンドルが最大のコンポーネント
- バンドルサイズが大きくなる場合はコード分割または遅延ローディングを検討

## リソース

- [VS Code拡張機能ドキュメント](https://code.visualstudio.com/api)
- [VS Code Marketplaceへの公開](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [OpenVSX Registry](https://open-vsx.org/)
- [GitHub Actions ドキュメント](https://docs.github.com/en/actions)
