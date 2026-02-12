# リリースガイド

このドキュメントでは、Hako View 拡張機能のバージョン管理とリリースプロセスについて説明します。

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

npm スクリプトを使って、バージョンアップとタグ作成を一度に実行できます。

```bash
# パッチバージョンアップ (0.1.0 → 0.1.1)
pnpm run release:patch

# マイナーバージョンアップ (0.1.0 → 0.2.0)
pnpm run release:minor

# メジャーバージョンアップ (0.1.0 → 1.0.0)
pnpm run release:major
```

これにより以下が自動実行されます：

1. `package.json` のバージョン更新
2. バージョン更新のコミット作成
3. 対応するタグ作成（例: `v0.2.0`）
4. main ブランチとタグをリモートにプッシュ
5. GitHub Actions が自動的にリリースワークフローを開始

### 手動リリース

細かくコントロールしたい場合は手動で実行できます。

```bash
# 1. package.json のバージョンを手動で編集
# "version": "0.2.0" に変更

# 2. 変更をコミット
git add package.json
git commit -m "Bump version to 0.2.0"

# 3. タグを作成（アノテーテッドタグ推奨）
git tag -a v0.2.0 -m "Release v0.2.0

新機能:
- 機能A追加
- 機能B改善

修正:
- バグX修正"

# 4. プッシュ
git push origin main
git push origin v0.2.0
```

## GitHub Actions ワークフロー

タグがプッシュされると、[.github/workflows/release.yml](../.github/workflows/release.yml) が自動実行されます。

### ビルドされるプラットフォーム

| ファイル名                   | プラットフォーム | アーキテクチャ           |
| ---------------------------- | ---------------- | ------------------------ |
| `hakoview-darwin-arm64.vsix` | macOS            | Apple Silicon (M1/M2/M3) |
| `hakoview-linux-x64.vsix`    | Linux            | x64 (Intel/AMD)          |
| `hakoview-win32-x64.vsix`    | Windows          | x64 (Intel/AMD)          |

**注**: `win32-x64` の `win32` は歴史的な呼称で、実際には64ビットWindowsを指します。

### ワークフローの流れ

1. **build ジョブ**: 3つのプラットフォーム向けに並列ビルド
   - 依存関係インストール
   - 拡張機能とwebviewをビルド
   - プラットフォーム別VSIXパッケージ作成
   - artifactとしてアップロード

2. **release ジョブ**: GitHub Releaseの作成
   - 全artifactをダウンロード
   - GitHub Releaseを作成し、3つのVSIXを添付

## タグ管理コマンド

### タグの確認

```bash
# 全タグをリスト表示
git tag --list

# 特定パターンのタグを検索
git tag --list "v0.*"

# タグの詳細情報を表示
git show v0.1.0

# タグとコミットの関係を表示
git log --oneline --decorate --graph
```

### タグの削除

```bash
# ローカルタグを削除
git tag -d v0.1.0

# リモートタグを削除
git push origin --delete v0.1.0

# ローカルとリモート両方を削除
git tag -d v0.1.0 && git push origin --delete v0.1.0
```

### タグの修正

既にプッシュしたタグは、削除して再作成する必要があります。

```bash
# 1. ローカルタグを削除
git tag -d v0.1.0

# 2. リモートタグを削除
git push origin --delete v0.1.0

# 3. 正しいコミットで再作成
git tag -a v0.1.0 -m "正しいリリースノート" <commit-hash>

# 4. 再プッシュ
git push origin v0.1.0
```

**注意**: 既にリリースが公開されている場合は、タグの修正ではなく新しいパッチバージョンをリリースすることを推奨します。

## リリースノートのベストプラクティス

### アノテーテッドタグを使用

軽量タグではなくアノテーテッドタグ（`-a`）を使うことで、詳細なメッセージを記録できます。

```bash
git tag -a v0.2.0 -m "Release v0.2.0

## 新機能
- ボクセルモデルの回転アニメーション
- カスタムカラーパレットのエクスポート/インポート

## 改善
- レンダリングパフォーマンスを20%向上
- メモリ使用量を削減

## バグ修正
- 大きなファイル読み込み時のクラッシュを修正
- Windows環境でのパス問題を解決

## 破壊的変更
- 設定キー名を変更: `hakoview.colormap` → `hakoview.defaultColormap`
"
```

### GitHub Release のボディ

GitHub Actions が自動生成する Release ボディは、[release.yml](../.github/workflows/release.yml) の `body` セクションで編集できます。

現在のテンプレート:

- バージョン番号
- プラットフォーム別パッケージの表
- インストール手順

必要に応じてワークフローファイルを編集してカスタマイズできます。

## トラブルシューティング

### ワークフローが開始されない

**原因**: タグがプッシュされていない、またはパターンが一致しない

**解決策**:

```bash
# タグがリモートにあるか確認
git ls-remote --tags origin

# ワークフローのトリガーパターンは v*.*.* なので、v から始まる必要がある
git tag v0.1.0  # ○
git tag 0.1.0   # × (v がない)
```

### ビルドが失敗する

**原因**: 依存関係の問題、ビルドスクリプトのエラー

**解決策**:

```bash
# ローカルで再現できるか確認
pnpm run package

# webview の依存関係も確認
cd webview && pnpm install && cd ..

# GitHub Actions のログを確認
# https://github.com/gen4438/HakoView/actions
```

### package.json とタグのバージョンが一致しない

**原因**: 手動でタグを作成したが、package.json を更新し忘れた

**解決策**:

```bash
# 自動リリーススクリプトを使用（推奨）
pnpm run release:minor

# または手動で package.json を更新してからタグ作成
```

## 参考リンク

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Git Basics - Tagging](https://git-scm.com/book/en/v2/Git-Basics-Tagging)
- [GitHub Actions - Creating releases](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generating-release-notes)
- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
