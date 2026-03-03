# HakoView インストールスクリプト (PowerShell)
# Usage: irm https://raw.githubusercontent.com/gen4438/HakoView/main/scripts/install-latest.ps1 | iex
[CmdletBinding()]
param(
    [string]$Platform = "",
    [ValidateSet("", "local", "server")]
    [string]$Target = "",
    [switch]$Server,
    [switch]$DownloadOnly,
    [switch]$Help
)

$ErrorActionPreference = "Stop"
$Repo = "gen4438/HakoView"

function Show-Usage {
    Write-Host @"
Usage: .\install-latest.ps1 [OPTIONS]
       irm https://raw.githubusercontent.com/gen4438/HakoView/main/scripts/install-latest.ps1 | iex

GitHub Releases から最新の HakoView VSIX をダウンロードして VS Code にインストールします。

Options:
  -Platform <PLATFORM>   プラットフォームを手動指定 (win32-x64, linux-x64, darwin-arm64)
  -Target <TARGET>       インストール先: local, server (デフォルト: 自動判定)
  -Server                -Target server のショートカット
  -DownloadOnly          ダウンロードのみ（インストールしない）
  -Help                  このヘルプを表示

Targets:
  local    ローカル VS Code にインストール (code --install-extension)
  server   VS Code Server にインストール (~/.vscode-server/extensions/ に展開)
           SSH 直接接続で Remote SSH 用に拡張機能を入れたい場合に使用

Examples:
  # ワンライナーインストール
  irm https://raw.githubusercontent.com/gen4438/HakoView/main/scripts/install-latest.ps1 | iex

  # VS Code Server にインストール
  .\install-latest.ps1 -Server

  # プラットフォーム指定
  .\install-latest.ps1 -Platform win32-x64

  # ダウンロードのみ
  .\install-latest.ps1 -DownloadOnly
"@
}

function Detect-Platform {
    $os = "win32"
    if ($IsLinux) { $os = "linux" }
    elseif ($IsMacOS) { $os = "darwin" }

    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    switch ($arch) {
        "X64"   { $archStr = "x64" }
        "Arm64" { $archStr = "arm64" }
        default { throw "エラー: 未対応のアーキテクチャ: $arch" }
    }
    return "$os-$archStr"
}

function Fetch-LatestTag {
    $url = "https://api.github.com/repos/$Repo/releases/latest"
    $response = Invoke-RestMethod -Uri $url -Headers @{ "User-Agent" = "HakoView-Installer" }
    return $response.tag_name
}

function Resolve-Target {
    if ($Server) { return "server" }
    if ($Target) { return $Target }

    # VS Code 統合ターミナル内かチェック
    if ($env:VSCODE_IPC_HOOK_CLI) { return "local" }

    # code コマンドがある → local
    if (Get-Command "code" -ErrorAction SilentlyContinue) { return "local" }

    # Windows の一般的パス
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
        "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd",
        "${env:ProgramFiles(x86)}\Microsoft VS Code\bin\code.cmd"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return "local" }
    }

    # VS Code Server がある → server
    $home = if ($env:USERPROFILE) { $env:USERPROFILE } else { $env:HOME }
    if ((Test-Path "$home/.vscode-server") -or (Test-Path "$home/.vscode-server-insiders")) {
        return "server"
    }

    return "local"
}

function Find-CodeCli {
    $codePath = Get-Command "code" -ErrorAction SilentlyContinue
    if ($codePath) { return $codePath.Source }

    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
        "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd",
        "${env:ProgramFiles(x86)}\Microsoft VS Code\bin\code.cmd"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }

    return $null
}

function Install-Local {
    param([string]$VsixPath)

    $CodeCli = Find-CodeCli
    if (-not $CodeCli) {
        Write-Error @"
エラー: code CLI が見つかりません。

以下を確認してください:
  - VS Code がインストールされ、code コマンドが PATH に通っていること
  - Remote SSH ホストの場合: VS Code の統合ターミナルから実行するか -Server を指定

code CLI なしでダウンロードのみ行う場合: .\install-latest.ps1 -DownloadOnly
"@
        exit 1
    }

    Write-Host "code CLI: $CodeCli"
    Write-Host "インストール中..."
    & $CodeCli --install-extension $VsixPath --force
}

function Install-Server {
    param([string]$VsixPath)

    $home = if ($env:USERPROFILE) { $env:USERPROFILE } else { $env:HOME }
    $extDir = $null
    foreach ($dir in @("$home/.vscode-server", "$home/.vscode-server-insiders")) {
        if (Test-Path $dir) {
            $extDir = "$dir/extensions"
            break
        }
    }

    if (-not $extDir) {
        Write-Error @"
エラー: VS Code Server が見つかりません (~/.vscode-server が存在しません)。
VS Code から一度 Remote SSH 接続して VS Code Server をインストールしてください。
"@
        exit 1
    }

    if (-not (Test-Path $extDir)) {
        New-Item -ItemType Directory -Path $extDir -Force | Out-Null
    }

    # VSIX を展開して extension.vsixmanifest から情報を取得
    # (package.json の publisher は null になることがあるため VSIX マニフェストを優先)
    $workDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $workDir -Force | Out-Null

    Write-Host "VSIX を展開中..."
    Expand-Archive -Path $VsixPath -DestinationPath $workDir -Force

    $pkgJson = Join-Path $workDir "extension/package.json"
    if (-not (Test-Path $pkgJson)) {
        Remove-Item -Recurse -Force $workDir -ErrorAction SilentlyContinue
        Write-Error "エラー: VSIX の構造が不正です (package.json が見つかりません)"
        exit 1
    }

    $publisher = $null
    $name = $null
    $version = $null

    # VSIX マニフェストから Publisher, Id, Version を読む（code --install-extension と同じソース）
    $vsixManifest = Join-Path $workDir "extension.vsixmanifest"
    if (Test-Path $vsixManifest) {
        [xml]$manifest = Get-Content $vsixManifest -Raw
        $identity = $manifest.PackageManifest.Metadata.Identity
        if ($identity) {
            $publisher = $identity.Publisher
            $name = $identity.Id
            $version = $identity.Version
        }
    }

    # フォールバック: VSIX マニフェストから取得できなかった場合は package.json を使う
    $pkg = Get-Content $pkgJson -Raw | ConvertFrom-Json
    if (-not $name) { $name = $pkg.name }
    if (-not $version) { $version = $pkg.version }
    if (-not $publisher -or $publisher -eq "null") { $publisher = $pkg.publisher }

    $extId = "$publisher.$name-$version"
    $targetDir = Join-Path $extDir $extId

    Write-Host "拡張機能: $publisher.$name v$version"

    # 既存バージョンを削除（パブリッシャー名違い・バージョン違い含む）
    Get-ChildItem -Path $extDir -Directory -Filter "*.$name-*" -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "既存バージョンを削除: $($_.Name)"
        Remove-Item -Recurse -Force $_.FullName
    }

    # extension/ を移動
    $srcDir = Join-Path $workDir "extension"
    Move-Item -Path $srcDir -Destination $targetDir -Force
    Remove-Item -Recurse -Force $workDir -ErrorAction SilentlyContinue

    # extensions.json にエントリを登録（VS Code Server が拡張機能を認識するために必要）
    $extensionsJson = Join-Path $extDir "extensions.json"
    $identifier = "$publisher.$name"
    $timestamp = [long]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())

    if (Test-Path $extensionsJson) {
        $extList = Get-Content $extensionsJson -Raw | ConvertFrom-Json
        # 同名拡張機能の既存エントリを削除
        $extList = @($extList | Where-Object { $_.identifier.id -notmatch "\.$([regex]::Escape($name))$" })
        # 新規エントリ追加
        $newEntry = [PSCustomObject]@{
            identifier = [PSCustomObject]@{ id = $identifier }
            version = $version
            location = [PSCustomObject]@{
                '$mid' = 1
                fsPath = $targetDir
                external = "file://$targetDir"
                path = $targetDir
                scheme = "file"
            }
            relativeLocation = $extId
            metadata = [PSCustomObject]@{
                isMachineScoped = $true
                installedTimestamp = $timestamp
                pinned = $true
                source = "vsix"
            }
        }
        $extList += $newEntry
        $extList | ConvertTo-Json -Depth 10 | Set-Content $extensionsJson -Encoding UTF8
        Write-Host "extensions.json を更新しました"
    }

    # .obsolete から同名拡張機能のエントリを削除
    $obsoleteFile = Join-Path $extDir ".obsolete"
    if (Test-Path $obsoleteFile) {
        $obsolete = Get-Content $obsoleteFile -Raw | ConvertFrom-Json
        $props = $obsolete.PSObject.Properties | Where-Object { $_.Name -notmatch "\.$([regex]::Escape($name))-" }
        $cleaned = [PSCustomObject]@{}
        foreach ($p in $props) { $cleaned | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value }
        $cleaned | ConvertTo-Json | Set-Content $obsoleteFile -Encoding UTF8
    }

    Write-Host "インストール先: $targetDir"
    Write-Host ""
    Write-Host "注意: VS Code を再起動（またはウィンドウのリロード）すると拡張機能が有効になります。"
}

# Main
if ($Help) {
    Show-Usage
    exit 0
}

# 統合ターミナル内で -Server が指定された場合の警告
if (($Server -or $Target -eq "server") -and $env:VSCODE_IPC_HOOK_CLI) {
    Write-Warning @"
VS Code 統合ターミナル内では -Server は不要です。
統合ターミナルではオプションなしで実行すれば code CLI 経由で正しくインストールされます。
-Server は SSH 直接接続時のみ使用してください。

中断します。-Server なしで再実行してください。
"@
    exit 1
}

if (-not $Platform) {
    $Platform = Detect-Platform
}
Write-Host "プラットフォーム: $Platform"

Write-Host "最新リリースを確認中..."
$Tag = Fetch-LatestTag
if (-not $Tag) {
    Write-Error "エラー: 最新リリースの取得に失敗しました"
    exit 1
}
Write-Host "最新バージョン: $Tag"

$Filename = "hakoview-$Tag-$Platform.vsix"
$DownloadUrl = "https://github.com/$Repo/releases/download/$Tag/$Filename"

# Download
$TmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null
$VsixPath = Join-Path $TmpDir $Filename

try {
    Write-Host "ダウンロード中: $Filename"
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $VsixPath -UseBasicParsing

    if (-not (Test-Path $VsixPath)) {
        Write-Error "エラー: ダウンロードに失敗しました。プラットフォーム '$Platform' 用のファイルが存在するか確認してください。"
        exit 1
    }
    Write-Host "ダウンロード完了"

    if ($DownloadOnly) {
        $Dest = Join-Path (Get-Location) $Filename
        Copy-Item $VsixPath $Dest
        Write-Host "保存先: $Dest"
        exit 0
    }

    # Resolve target and install
    $ResolvedTarget = Resolve-Target
    Write-Host "インストール先: $ResolvedTarget"

    switch ($ResolvedTarget) {
        "local"  { Install-Local -VsixPath $VsixPath }
        "server" { Install-Server -VsixPath $VsixPath }
    }

    Write-Host ""
    Write-Host "インストール完了: HakoView $Tag"
}
finally {
    Remove-Item -Recurse -Force $TmpDir -ErrorAction SilentlyContinue
}
