#!/usr/bin/env bash
# HakoView インストールスクリプト
# Usage: curl -fsSL https://raw.githubusercontent.com/gen4438/HakoView/main/scripts/install-latest.sh | bash
set -euo pipefail

REPO="gen4438/HakoView"
DOWNLOAD_ONLY=false
PLATFORM=""
TARGET=""  # auto, local, server

usage() {
  cat <<'EOF'
Usage: install-latest.sh [OPTIONS]
       curl -fsSL https://raw.githubusercontent.com/gen4438/HakoView/main/scripts/install-latest.sh | bash

GitHub Releases から最新の HakoView VSIX をダウンロードして VS Code にインストールします。

インストール先:
  - ローカル VS Code:       ローカルのターミナルで実行（デフォルト）
  - Remote SSH ホスト:      VS Code 統合ターミナル（リモート側）で実行（デフォルト）
  - Remote SSH ホスト:      SSH 直接接続で --server を指定

Options:
  -p, --platform PLATFORM   プラットフォームを手動指定 (linux-x64, darwin-arm64, win32-x64)
  -t, --target TARGET       インストール先を指定: local, server (デフォルト: 自動判定)
      --server              --target server のショートカット
  -d, --download-only       ダウンロードのみ（インストールしない）
  -h, --help                このヘルプを表示

Targets:
  local    ローカル VS Code にインストール（code --install-extension）
  server   VS Code Server にインストール（~/.vscode-server/extensions/ に展開）
           SSH 直接接続で Remote SSH 用に拡張機能を入れたい場合に使用

Examples:
  # ワンライナーインストール（ローカル or 統合ターミナル）
  curl -fsSL https://raw.githubusercontent.com/gen4438/HakoView/main/scripts/install-latest.sh | bash

  # SSH 直接接続で VS Code Server にインストール
  curl -fsSL https://raw.githubusercontent.com/gen4438/HakoView/main/scripts/install-latest.sh | bash -s -- --server

  # プラットフォーム指定
  curl -fsSL https://raw.githubusercontent.com/gen4438/HakoView/main/scripts/install-latest.sh | bash -s -- -p darwin-arm64

  # ダウンロードのみ
  bash install-latest.sh --download-only
EOF
}

detect_platform() {
  local os arch
  os=$(uname -s)
  arch=$(uname -m)

  case "$os" in
    Linux)                    os="linux" ;;
    Darwin)                   os="darwin" ;;
    MINGW*|MSYS*|CYGWIN*)     os="win32" ;;
    *) echo "エラー: 未対応のOS: $os" >&2; exit 1 ;;
  esac

  case "$arch" in
    x86_64|amd64)   arch="x64" ;;
    aarch64|arm64)  arch="arm64" ;;
    *) echo "エラー: 未対応のアーキテクチャ: $arch" >&2; exit 1 ;;
  esac

  echo "${os}-${arch}"
}

fetch_latest_tag() {
  if command -v gh &>/dev/null; then
    gh api "repos/${REPO}/releases/latest" --jq '.tag_name'
  else
    curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4
  fi
}

resolve_target() {
  if [[ -n "$TARGET" ]]; then
    echo "$TARGET"
    return
  fi

  # 統合ターミナル内なら code CLI をそのまま使う（local/remote どちらも正しく動く）
  if [[ -n "${VSCODE_IPC_HOOK_CLI:-}" ]]; then
    echo "local"
    return
  fi

  # 統合ターミナル外で code が PATH にある → local（ローカル VS Code）
  if command -v code &>/dev/null; then
    echo "local"
    return
  fi

  # code が PATH になく、VS Code Server がある → server
  if [[ -d "$HOME/.vscode-server" ]] || [[ -d "$HOME/.vscode-server-insiders" ]]; then
    echo "server"
    return
  fi

  echo "local"
}

install_local() {
  local vsix_path="$1"

  local code_cli
  if command -v code &>/dev/null; then
    code_cli="code"
  else
    echo "エラー: code CLI が見つかりません。" >&2
    echo "" >&2
    echo "以下を確認してください:" >&2
    echo "  - VS Code がインストールされ、code コマンドが PATH に通っていること" >&2
    echo "  - Remote SSH ホストの場合: VS Code の統合ターミナルから実行するか --server を指定" >&2
    echo "" >&2
    echo "code CLI なしでダウンロードのみ行う場合: $0 --download-only" >&2
    exit 1
  fi

  echo "code CLI: ${code_cli}"
  echo "インストール中..."
  "$code_cli" --install-extension "$vsix_path" --force
}

install_server() {
  local vsix_path="$1"

  # VS Code Server の extensions ディレクトリを探す
  local ext_dir=""
  for dir in "$HOME/.vscode-server" "$HOME/.vscode-server-insiders"; do
    if [[ -d "$dir" ]]; then
      ext_dir="$dir/extensions"
      break
    fi
  done

  if [[ -z "$ext_dir" ]]; then
    echo "エラー: VS Code Server が見つかりません (~/.vscode-server が存在しません)。" >&2
    echo "VS Code から一度 Remote SSH 接続して VS Code Server をインストールしてください。" >&2
    exit 1
  fi

  mkdir -p "$ext_dir"

  # VSIX からパッケージ情報を読み取って展開先ディレクトリ名を決定
  # VSIX は ZIP 形式。extension.vsixmanifest の Identity 要素が正式なメタデータ
  # (package.json の publisher は null になることがあるため使わない)
  local work_dir
  work_dir=$(mktemp -d)

  echo "VSIX を展開中..."
  unzip -q "$vsix_path" -d "$work_dir"

  local vsix_manifest="$work_dir/extension.vsixmanifest"
  local pkg_json="$work_dir/extension/package.json"

  if [[ ! -f "$pkg_json" ]]; then
    echo "エラー: VSIX の構造が不正です (package.json が見つかりません)" >&2
    rm -rf "$work_dir"
    exit 1
  fi

  local publisher name version

  # VSIX マニフェストから Publisher, Id, Version を読む（code --install-extension と同じソース）
  if [[ -f "$vsix_manifest" ]]; then
    local identity
    identity=$(grep -o '<Identity[^/]*/>' "$vsix_manifest")
    publisher=$(echo "$identity" | grep -o 'Publisher="[^"]*"' | cut -d'"' -f2)
    name=$(echo "$identity" | grep -o ' Id="[^"]*"' | cut -d'"' -f2)
    version=$(echo "$identity" | grep -o 'Version="[^"]*"' | cut -d'"' -f2)
  fi

  # フォールバック: VSIX マニフェストから取得できなかった場合は package.json を使う
  if [[ -z "$name" ]]; then
    if command -v jq &>/dev/null; then
      name=$(jq -r '.name' "$pkg_json")
    else
      name=$(grep -o '"name": *"[^"]*"' "$pkg_json" | head -1 | cut -d'"' -f4)
    fi
  fi
  if [[ -z "$version" ]]; then
    if command -v jq &>/dev/null; then
      version=$(jq -r '.version' "$pkg_json")
    else
      version=$(grep -o '"version": *"[^"]*"' "$pkg_json" | head -1 | cut -d'"' -f4)
    fi
  fi
  if [[ -z "$publisher" || "$publisher" == "null" ]]; then
    if command -v jq &>/dev/null; then
      publisher=$(jq -r '.publisher // empty' "$pkg_json")
    else
      publisher=$(grep -o '"publisher": *"[^"]*"' "$pkg_json" | head -1 | cut -d'"' -f4)
    fi
  fi

  local ext_id="${publisher}.${name}-${version}"
  local target_dir="${ext_dir}/${ext_id}"

  echo "拡張機能: ${publisher}.${name} v${version}"

  # 既存の同一拡張機能を削除（パブリッシャー名違い・バージョン違い含む）
  for existing in "$ext_dir"/*.${name}-*; do
    if [[ -d "$existing" ]]; then
      echo "既存バージョンを削除: $(basename "$existing")"
      rm -rf "$existing"
    fi
  done

  # extension/ ディレクトリを移動
  mv "$work_dir/extension" "$target_dir"
  rm -rf "$work_dir"

  # extensions.json にエントリを登録し .obsolete をクリーンアップ
  # （VS Code Server が拡張機能を認識するために必要）
  local extensions_json="${ext_dir}/extensions.json"
  local obsolete_file="${ext_dir}/.obsolete"
  local identifier="${publisher}.${name}"
  local timestamp
  timestamp=$(date +%s000)

  if [[ -f "$extensions_json" ]]; then
    # python3 > jq の優先順で JSON 操作ツールを選択
    if command -v python3 &>/dev/null; then
      python3 - "$extensions_json" "$obsolete_file" "$identifier" "$version" "$target_dir" "$ext_id" "$timestamp" "$name" <<'PYEOF'
import json, sys, os
ext_json_path, obsolete_path, identifier, version, target_dir, ext_id, timestamp, ext_name = sys.argv[1:]

# extensions.json を更新
with open(ext_json_path, "r") as f:
    extensions = json.load(f)
extensions = [e for e in extensions if not e.get("identifier", {}).get("id", "").endswith("." + ext_name)]
extensions.append({
    "identifier": {"id": identifier},
    "version": version,
    "location": {"$mid": 1, "fsPath": target_dir, "external": "file://" + target_dir, "path": target_dir, "scheme": "file"},
    "relativeLocation": ext_id,
    "metadata": {"isMachineScoped": True, "installedTimestamp": int(timestamp), "pinned": True, "source": "vsix"}
})
with open(ext_json_path, "w") as f:
    json.dump(extensions, f, indent=2)

# .obsolete をクリーンアップ
if os.path.isfile(obsolete_path):
    with open(obsolete_path, "r") as f:
        obsolete = json.load(f)
    obsolete = {k: v for k, v in obsolete.items() if "." + ext_name + "-" not in k}
    with open(obsolete_path, "w") as f:
        json.dump(obsolete, f, indent=2)
PYEOF
      echo "extensions.json を更新しました"

    elif command -v jq &>/dev/null; then
      local new_entry
      new_entry=$(cat <<ENTRY
{
  "identifier": {"id": "${identifier}"},
  "version": "${version}",
  "location": {
    "\$mid": 1,
    "fsPath": "${target_dir}",
    "external": "file://${target_dir}",
    "path": "${target_dir}",
    "scheme": "file"
  },
  "relativeLocation": "${ext_id}",
  "metadata": {
    "isMachineScoped": true,
    "installedTimestamp": ${timestamp},
    "pinned": true,
    "source": "vsix"
  }
}
ENTRY
)
      local updated
      updated=$(jq --argjson entry "$new_entry" --arg name "$name" \
        '[.[] | select(.identifier.id | test("\\." + $name + "$") | not)] + [$entry]' \
        "$extensions_json")
      echo "$updated" > "$extensions_json"

      if [[ -f "$obsolete_file" ]]; then
        local cleaned
        cleaned=$(jq --arg name "$name" \
          'to_entries | [.[] | select(.key | test("\\." + $name + "-") | not)] | from_entries' \
          "$obsolete_file")
        echo "$cleaned" > "$obsolete_file"
      fi
      echo "extensions.json を更新しました"

    else
      echo "警告: python3 も jq も見つかりません。extensions.json への登録をスキップします。" >&2
      echo "VS Code の統合ターミナルから再インストールしてください。" >&2
    fi
  fi

  echo "インストール先: ${target_dir}"
  echo ""
  echo "注意: VS Code を再起動（またはウィンドウのリロード）すると拡張機能が有効になります。"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--platform) PLATFORM="$2"; shift 2 ;;
    -t|--target) TARGET="$2"; shift 2 ;;
    --server) TARGET="server"; shift ;;
    -d|--download-only) DOWNLOAD_ONLY=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "エラー: 不明なオプション: $1" >&2; usage >&2; exit 1 ;;
  esac
done

# Validate target
if [[ -n "$TARGET" ]] && [[ "$TARGET" != "local" ]] && [[ "$TARGET" != "server" ]]; then
  echo "エラー: --target は 'local' または 'server' を指定してください" >&2
  exit 1
fi

# 統合ターミナル内で --server が指定された場合の警告
if [[ "$TARGET" == "server" ]] && [[ -n "${VSCODE_IPC_HOOK_CLI:-}" ]]; then
  echo "警告: VS Code 統合ターミナル内では --server は不要です。" >&2
  echo "統合ターミナルではオプションなしで実行すれば code CLI 経由で正しくインストールされます。" >&2
  echo "--server は SSH 直接接続時のみ使用してください。" >&2
  echo "" >&2
  echo "続行しますか？ 5秒後に中断します。Ctrl+C で中断、Enter で続行..." >&2
  if read -t 5 -r; then
    echo "続行します..."
  else
    echo "" >&2
    echo "中断しました。--server なしで再実行してください:" >&2
    echo "  curl -fsSL https://raw.githubusercontent.com/gen4438/HakoView/main/scripts/install-latest.sh | bash" >&2
    exit 1
  fi
fi

# Detect platform
if [[ -z "$PLATFORM" ]]; then
  PLATFORM=$(detect_platform)
fi
echo "プラットフォーム: ${PLATFORM}"

# Fetch latest release tag
echo "最新リリースを確認中..."
TAG=$(fetch_latest_tag)
if [[ -z "$TAG" ]]; then
  echo "エラー: 最新リリースの取得に失敗しました" >&2
  exit 1
fi
echo "最新バージョン: ${TAG}"

# Build download URL
FILENAME="hakoview-${TAG}-${PLATFORM}.vsix"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/${FILENAME}"

# Download to temp directory
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
VSIX_PATH="${TMPDIR}/${FILENAME}"

echo "ダウンロード中: ${FILENAME}"
if command -v gh &>/dev/null; then
  gh release download "$TAG" --repo "$REPO" --pattern "$FILENAME" --dir "$TMPDIR"
else
  curl -fSL -o "$VSIX_PATH" "$DOWNLOAD_URL"
fi

if [[ ! -f "$VSIX_PATH" ]]; then
  echo "エラー: ダウンロードに失敗しました。プラットフォーム '${PLATFORM}' 用のファイルが存在するか確認してください。" >&2
  exit 1
fi
echo "ダウンロード完了"

# Download only mode
if [[ "$DOWNLOAD_ONLY" == true ]]; then
  DEST="./${FILENAME}"
  cp "$VSIX_PATH" "$DEST"
  echo "保存先: ${DEST}"
  exit 0
fi

# Resolve target and install
RESOLVED_TARGET=$(resolve_target)
echo "インストール先: ${RESOLVED_TARGET}"

case "$RESOLVED_TARGET" in
  local)  install_local "$VSIX_PATH" ;;
  server) install_server "$VSIX_PATH" ;;
esac

echo ""
echo "インストール完了: HakoView ${TAG}"
