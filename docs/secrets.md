# GitHub Secrets 設定ガイド

VS Code Marketplace および OpenVSX Registry への自動公開を有効にするためには、GitHub Secrets を設定する必要があります。

## GitHub Secrets へのアクセス

### 1. リポジトリ設定ページを開く

1. https://github.com/gen4438/HakoView に移動
2. **Settings** タブをクリック
3. 左側のサイドバーで **Secrets and variables** → **Actions** をクリック

## VS Code Marketplace トークン設定

### トークン作成手順

1. https://marketplace.visualstudio.com/manage/publishers にアクセス
2. ログインまたはアカウント作成
3. 発行者プロフィールをクリック
4. **Security** セクションに移動
5. 新しい Personal Access Token (PAT) を作成
6. スコープに `Publish` を含める

### GitHub に追加

1. **New repository secret** をクリック
2. Name: `VSCODE_MARKETPLACE_TOKEN`
3. 作成したトークンを貼り付け
4. **Add secret** をクリック

## OpenVSX Registry トークン設定

### トークン作成手順

1. https://open-vsx.org/ にアクセス
2. ログインまたはアカウント作成
3. アカウント設定に移動
4. アクセストークンを生成

### GitHub に追加

1. **New repository secret** をクリック
2. Name: `OPENVSX_TOKEN`
3. 作成したトークンを貼り付け
4. **Add secret** をクリック

## ワークフロー設定

Secrets を設定すると:

1. Git タグをプッシュするとビルドワークフローが起動
2. VSIX ファイルが作成され GitHub Release に添付
3. Release を公開すると公開ワークフローが起動
4. トークンが設定されている場合、自動的に両マーケットプレイスに公開

## 検証方法

ワークフローが正常に動作しているかを確認:

1. リポジトリに移動
2. **Actions** タブをクリック
3. ワークフローが実行されていることを確認
4. ジョブログで公開が成功したかどうかを確認

## トラブルシューティング

### 公開が失敗する場合

- トークンの有効期限を確認
- トークンに正しい権限がはあるか確認
- Action ログで具体的なエラーメッセージを確認
- 拡張機能の発行者 ID がマーケットプレイスアカウントと一致しているか確認

### 確認方法

GitHub Actions で失敗を確認するには:

1. https://github.com/gen4438/HakoView/actions にアクセス
2. 失敗したワークフロー（`publish.yml`）をクリック
3. ジョブログを確認して具体的なエラーを特定

## セキュリティ上の注意

- トークンを絶対にコード内に記載しないでください
- GitHub Secrets を使用することにより、トークンは保護されます
- トークンをローカルマシンに保存する必要はありません
- 不要になった古いトークンは削除してください

## 次のステップ

Secrets を設定した後:

1. 最初のリリースを作成（Git タグをプッシュ）
2. GitHub Actions が自動的に動作
3. ワークフローのログを確認
4. オプション: Release を公開してマーケットプレイス公開をトリガー

詳細は [`docs/checklist.md`](./checklist.md) を参照してください。
