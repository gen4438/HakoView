# Hako View - リリース配布チェックリスト

このチェックリストに従って、最初のバージョンをリリース・配布するための準備を整えてください。

## 事前準備（1回限り）

### 1. GitHub 設定

- [ ] https://github.com/gen4438/HakoView/settings/secrets/actions にアクセス
- [ ] [`docs/secrets.md`](./secrets.md) に従い、以下を追加（オプションですが推奨）:
  - [ ] `VSCODE_MARKETPLACE_TOKEN`
  - [ ] `OPENVSX_TOKEN`

### 2. ファイルの確認

- [ ] ✅ `dist/hakoview.vsix` - 正常に作成済み（480 KB）
- [ ] ✅ `LICENSE` - MIT ライセンス追加済み
- [ ] ✅ `package.json` - リポジトリとスクリプト更新済み
- [ ] ✅ `.github/workflows/release.yml` - GitHub Release 自動作成
- [ ] ✅ `.github/workflows/publish.yml` - マーケットプレイス公開
- [ ] ✅ `.vscodeignore` - 配布用に最適化済み

### 3. ドキュメント確認

- [ ] ✅ `docs/release.md` - リリースプロセスを理解
- [ ] ✅ `docs/setup.md` - セットアップ概要を確認
- [ ] ✅ `docs/secrets.md` - Secrets 設定ガイル（トークン設定時のみ）
- [ ] ✅ `docs/template.md` - リリースノートテンプレート

## 最初のリリース作成

### ステップ1: バージョン更新

```bash
# package.json でバージョンを更新
# CHANGELOG.md で変更内容を記述
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.1.0"
```

- [ ] `package.json` でバージョン更新
- [ ] `CHANGELOG.md` で変更内容を記述

### ステップ2: Git タグ作成

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin main --tags
```

- [ ] Git タグ作成とプッシュ

### ステップ3: GitHub Actions を監視

- [ ] https://github.com/gen4438/HakoView/actions にアクセス
- [ ] `Release VSIX` ワークフローが完了するまで待機
- [ ] VSIXが正常に作成されたことを確認

### ステップ4: リリースノート追加

- [ ] https://github.com/gen4438/HakoView/releases にアクセス
- [ ] 自動作成されたリリースを編集
- [ ] [`docs/template.md`](./template.md) を参考にリリースノートを追加
- [ ] 変更内容の確認

### ステップ5: Release を公開

- [ ] 「Publish release」ボタンをクリック
- [ ] これによりマーケットプレイス公開ワークフローがトリガーされます

### ステップ6: 配布確認

- [ ] ✅ GitHub Release: https://github.com/gen4438/HakoView/releases
  - [ ] VSIXファイルがアタッチされている
  - [ ] リリースノートが表示されている
- [ ] マーケットプレイス公開（トークン設定時のみ）:
  - [ ] Actions ログで publish.yml が成功していることを確認
  - [ ] VS Code Marketplace で確認: https://marketplace.visualstudio.com/items?itemName=gen4438.hakoview
  - [ ] OpenVSX で確認: https://open-vsx.org/extension/gen4438/hakoview

## 手動リリース（必要な場合）

git タグを使わずにリリースを作成する場合:

```bash
# ローカルで VSIX をビルド
pnpm run vsix

# GitHub Release を手動作成
# その後、必要に応じてマーケットプレイスに公開
pnpm run publish:marketplace -- --pat YOUR_TOKEN
pnpm run publish:openvsx -- --pat YOUR_TOKEN
```

- [ ] ローカルで VSIX をビルド
- [ ] GitHub Release を手動作成
- [ ] マーケットプレイス公開（必要な場合）

## 今後のリリース

次のリリース以降は簡略化されたプロセスに従います:

1. `package.json` でバージョン更新
2. `CHANGELOG.md` を更新
3. コミット: `git commit -m "chore: bump version to X.Y.Z"`
4. タグ作成: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
5. プッシュ: `git push origin main --tags`
6. 自動化が完了するまで待機
7. GitHub でリリースノート追加
8. Release を公開

## トラブルシューティング

### Release ワークフローが起動しない

- タグ形式を確認: `v1.2.3`（'v' で始まる必要があります）
- 確認URL: https://github.com/gen4438/HakoView/actions

### VSIX ビルドが失敗

- ローカルで実行: `pnpm run vsix`
- エラーログを確認
- TypeScript のコンパイル確認: `pnpm run check-types`

### マーケットプレイス公開が失敗

- GitHub Secrets でトークンが正しく設定されているか確認
- トークンの有効期限を確認
- トークンに必要な権限があるか確認
- Actions ログで詳細なエラーを確認

### Publisher ID が一致しない

- `gen4438` が VS Code Marketplace ユーザー名であることを確認
- 必要に応じて最初のリリース前に `package.json` を更新

## クイックリファレンス

| タスク               | コマンド                                     |
| -------------------- | -------------------------------------------- |
| ローカルで VSIX 作成 | `pnpm run vsix`                              |
| Marketplace に公開   | `pnpm run publish:marketplace`               |
| OpenVSX に公開       | `pnpm run publish:openvsx`                   |
| 完全に再ビルド       | `pnpm run build:prod`                        |
| Release を表示       | https://github.com/gen4438/HakoView/releases |

## リソース

- **最新Release**: https://github.com/gen4438/HakoView/releases
- **完全ガイド**: [`docs/release.md`](./release.md)
- **セットアップガイド**: [`docs/setup.md`](./setup.md)
- **Secrets設定**: [`docs/secrets.md`](./secrets.md)
- **リリースノートテンプレート**: [`docs/template.md`](./template.md)

---

## ✅ 準備完了！

拡張機能は配布準備が整っています。以下のいずれかの방法 でリリースできます:

1. **ローカルでビルド**: `pnpm run vsix`
2. **GitHub Release を自動作成**: Git タグをプッシュ
3. **複数マーケットプレイスに公開**: GitHub Secrets を設定
4. **ユーザーはインストール可能**:
   - GitHub Releases（VSIX ダウンロード）
   - VS Code Marketplace
   - OpenVSX Registry

🎉 リリース準備完了!
