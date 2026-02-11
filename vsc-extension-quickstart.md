# VS Code拡張機能へようこそ

## このフォルダの構成

* このフォルダには拡張機能に必要なファイル一式が含まれています。
* `package.json` - 拡張機能とコマンドを宣言するマニフェストです。
  * サンプルはコマンドを登録し、タイトルとコマンド名を定義します。これによりコマンドパレットに表示されますが、まだプラグインを読み込む必要はありません。
* `src/extension.ts` - コマンド実装のメインファイルです。
  * `activate` 関数をエクスポートしており、拡張機能が初めて有効化されたタイミング（コマンド実行時）に呼ばれます。`activate` 内で `registerCommand` を呼び出します。
  * 実装関数を `registerCommand` の第2引数として渡します。

## セットアップ

* 推奨拡張機能をインストールします（amodio.tsl-problem-matcher、ms-vscode.extension-test-runner、dbaeumer.vscode-eslint）。

## すぐに動かす

* `F5` を押して拡張機能を読み込んだ新しいウィンドウを開きます。
* コマンドパレット（Windows/Linux: `Ctrl+Shift+P`、Mac: `Cmd+Shift+P`）を開き、`Hello World` と入力してコマンドを実行します。
* `src/extension.ts` にブレークポイントを設定してデバッグできます。
* 出力はデバッグコンソールで確認できます。

## 変更の反映

* `src/extension.ts` を変更したらデバッグツールバーから拡張機能を再起動できます。
* VS Codeウィンドウを再読み込みする場合は `Ctrl+R`（Macは `Cmd+R`）を使用します。

## APIの参照

* `node_modules/@types/vscode/index.d.ts` を開くとAPI一覧を確認できます。

## テストの実行

* [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner) をインストールします。
* **Tasks: Run Task** から "watch" タスクを実行してください。起動していないとテストが検出されない場合があります。
* アクティビティバーのTestingビューを開き、Run Testボタンを押すか、`Ctrl/Cmd + ; A` を使用します。
* テスト結果はTest Resultsビューで確認できます。
* `src/test/extension.test.ts` を編集するか、`test` フォルダに新しいテストファイルを追加できます。
  * テストランナーは `**.test.ts` に一致するファイルのみを対象にします。
  * `test` フォルダ内にサブフォルダを作って整理しても構いません。

## さらに進める

* [バンドル](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)して拡張機能のサイズ削減と起動高速化を行います。
* [拡張機能を公開](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)してMarketplaceに公開できます。
* [CIの自動化](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)を設定してビルドを自動化できます。
