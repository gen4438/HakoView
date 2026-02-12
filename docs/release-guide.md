# リリースガイド - Hako View

このドキュメントでは、Hako View拡張機能のリリースプロセスについて説明します。

## バージョニング戦略

**セマンティックバージョニング** (Semantic Versioning) を採用しています。

```
v{MAJOR}.{MINOR}.{PATCH}
```

- **MAJOR**: 破壊的変更（APIの非互換な変更）
- **MINOR**: 後方互換性のある新機能追加
- **PATCH**: 後方互換性のあるバグ修正

### 例

- `v0.1.0` → 初期開発版
- `v0.2.0` → 新機能追加（破壊的変更なし）
- `v0.2.1` → バグ修正
- `v1.0.0` → 正式版リリース（安定版API）

## リリース手順

### 自動リリース（推奨）

package.jsonのスクリプトを使用して、バージョン更新からリリースまでを自動化できます。

```bash
# パッチバージョンアップ (0.3.1 → 0.3.2)
pnpm run release:patch

# マイナーバージョンアップ (0.3.1 → 0.4.0)
pnpm run release:minor

# メジャーバージョンアップ (0.3.1 → 1.0.0)
pnpm run release:major
```

これらのコマンドは `scripts/bump-version.js` を実行し、以下を自動的に行います：

1. `package.json` と `webview/package.json` のバージョン更新
2. バージョン更新のコミット作成
3. 対応するGitタグ作成（例: `v0.4.0`）
4. mainブランチとタグをリモートにプッシュ
5. GitHub Actionsが自動的にリリースワークフローを開始

### リリースワークフローの流れ

タグがプッシュされると、`.github/workflows/release.yml` が自動実行されます：

1. **ビルドジョブ**: 3つのプラットフォーム向けに並列ビルド
   - macOS (Apple Silicon): `hakoview-vX.Y.Z-darwin-arm64.vsix`
   - Linux (x64): `hakoview-vX.Y.Z-linux-x64.vsix`
   - Windows (x64): `hakoview-vX.Y.Z-win32-x64.vsix`

2. **リリースジョブ**: GitHub Releaseの作成
   - 全てのプラットフォーム別VSIXを添付
   - インストール手順を含むリリースノートを自動生成

## ローカルテスト

リリース前にローカルでVSIXパッケージをテストできます：

```bash
# VSIXパッケージを作成（バージョン付きファイル名）
pnpm run vsix

# または vsce コマンドを直接使用
pnpm exec vsce package --allow-missing-repository
```

作成されたVSIXは `dist/` ディレクトリに保存されます。

### VSCodeへの手動インストール

1. VS Codeを開く
2. 拡張機能ビュー (Ctrl+Shift+X / Cmd+Shift+X) を開く
3. 「...」メニュー → 「VSIXからのインストール...」をクリック
4. `dist/hakoview-vX.Y.Z.vsix` ファイルを選択

## トラブルシューティング

### ワークフローが開始されない

**原因**: タグがプッシュされていない、またはタグ形式が正しくない

**解決策**:

```bash
# タグがリモートにあるか確認
git ls-remote --tags origin

# タグ形式は v*.*.* である必要がある
git tag v0.4.0  # ○ 正しい
git tag 0.4.0   # × vがない
```

### ビルドが失敗する

**原因**: 依存関係の問題、ビルドスクリプトのエラー

**解決策**:

```bash
# ローカルで再現できるか確認
pnpm run build:prod

# webviewの依存関係も確認
cd webview && pnpm install && cd ..

# GitHub Actionsのログを確認
# https://github.com/gen4438/HakoView/actions
```

### バージョン番号の修正が必要な場合

既にタグをプッシュしてしまった場合は、削除して再作成できます：

```bash
# ローカルタグを削除
git tag -d v0.4.0

# リモートタグを削除
git push origin --delete v0.4.0

# 正しいバージョンで再作成
pnpm run release:minor  # または patch/major
```

**注意**: 既にリリースが公開されている場合は、タグの修正ではなく新しいパッチバージョンをリリースすることを推奨します。

## リリースチェックリスト

リリース前に確認すべき項目：

- [ ] `pnpm run lint` が通る
- [ ] `pnpm run test` が通る
- [ ] `pnpm run check-types` が通る
- [ ] ローカルで `pnpm run build:prod` が成功する
- [ ] README.mdが最新の状態
- [ ] 必要に応じてCHANGELOG.mdを更新

## 参考リンク

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Git Basics - Tagging](https://git-scm.com/book/en/v2/Git-Basics-Tagging)
- [GitHub Actions - Creating releases](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generating-release-notes)
- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
