---
covers:
  - backend/crates/novira-core/src/settings.rs
  - backend/crates/novira-core/src/data_location.rs
  - backend/crates/novira-core/src/service/engine_settings.rs
  - backend/crates/novira-core/src/service/memory.rs
  - backend/crates/novira-core/src/comfy/process.rs
  - backend/crates/novira-core/src/unfinished.rs
  - backend/crates/novira-core/src/backup/**
  - backend/crates/novira-core/src/service/backups.rs
  - backend/crates/novira-core/src/types.rs
  - backend/src-tauri/src/command_list.rs
  - backend/src-tauri/src/dialogs.rs
  - frontend/src/features/settings/**
  - frontend/src/state/settings.ts
  - frontend/src/state/uiState.ts
  - frontend/src/state/lowMemory.ts
---
# 設定とエンジン設定

設定は、セッションを越えて残る選択。バックエンドの `settings.json`（どの ComfyUI を動かすか、追加のモデルフォルダ、低メモリモード、Civitai の照会）とそれを変える設定画面のタブ、未完了のダウンロードの一覧、ページの保存状態のリセット、利用者のデータのバックアップと復元、ネイティブのファイルダイアログを扱う。

## 動作

**ファイル。** `settings.json` はデータフォルダにある（01-runtime.md を参照）。`backend/crates/novira-core/src/settings.rs` の `Settings` が読む。無いキーは既定値になり、未知のキーは無視され、壊れたファイルは理由を示して起動を止める（`backend/src-tauri/src/lib.rs`）。`Settings::save_key` は 1 つのキーだけを置き換えて他を残し、`settings.json.tmp` 経由で書く。キーと既定値は次のとおり。

- `comfyuiUrl`（未設定）は起動済みの ComfyUI につなぐ。`comfyuiDir`（未設定）は既存のローカルの ComfyUI フォルダを使う。アドレスと表示するモードは URL で決まる。両方あるときは、何も応答しなければそのフォルダの ComfyUI をそのアドレスで起動する。アドレスはこの PC のものでなければならない（01-generation.md を参照）。どちらも無ければ、アプリ自身のコピーを動かす。
- `comfyuiPackage` は `nvidia` か `amd`。`comfyuiPython`（未設定）と `comfyuiArgs`（`[]`）は、novira が起動する ComfyUI のプロセスに渡す。
- `modelRoots`（`[]`）は追加のモデルフォルダで、最大 16。中にあるモデルパックも読む（02-model-packs.md を参照）。
- `gpuLock` は `auto`（変数 `NOVIRA_GPU_LOCK`。未設定ならロックなし）、フォルダのパス、`""`（オフ）のいずれか。
- `comfyuiStartTimeoutSecs` は 180。許可範囲は 30 から 1800。
- `civitaiLookup` は `false`。`lowMemoryMode` は `false`。`civitaiApiKey` は平文の予備で、アカウントタブで保存したキーは暗号化される（01-models.md を参照）。

**そのほかのタブ。** 一般（`waitForEngine` を含む。既定はオンで、オフにすると起動画面がエンジンやノード一覧を待たず、エンジンのバナーが状態を示す。`useSplashGate`）、生成（下書き画面の開始枚数と位置 `draftCount`・`draftPosition` を含む）、ギャラリー、編集、漫画とテキスト（漫画が無ければテキスト、フォントのみ）、開発者は、ページ自身の設定を変える。保存先は `novira.settings`（`frontend/src/state/settings.ts`）。項目は `frontend/src/features/settings/settingsPanes.tsx`。

**設定: エンジン**（`frontend/src/features/settings/EnginePane.tsx`）。表示するのは、データフォルダ、自前の ComfyUI の場所（`comfyuiRoot`）、ComfyUI のモード（設定されていれば URL かフォルダ）。`comfyuiPython`・`comfyuiArgs`・`gpuLock` は表示しない。変えられるのは次の 5 つ（検査はバックエンド）。

- ComfyUI のパッケージ（インストール済みで異なるときは、画面が先に確認する）
- 起動のタイムアウト（スライダー。30 から 1800 秒を 10 刻み、操作が止まって 500 ms 後に保存）
- Civitai 照会のスイッチ
- 追加のモデルフォルダ（フォルダダイアログで追加し、行ごとに削除）
- データフォルダと ComfyUI のインストール先フォルダ（`LocationRows.tsx`。フォルダダイアログを開くシェルのコマンド `choose_data_dir`・`cancel_data_dir_change`・`choose_comfyui_install_dir`・`reset_comfyui_install_dir` で、ブラウザサーバーでは提供しない）。データフォルダは、自分が指す先のフォルダの中には置けないので、利用者の設定フォルダのポインタファイルに記録する（`data_location.rs`、`%LOCALAPPDATA%/novira/data-location.json`）。読む順は `NOVIRA_DATA_DIR`、このポインタ、既定（デバッグビルドは `data-location-dev.json`）。`NOVIRA_DATA_DIR` があるときはポインタを使わず、固定と表示する。初回起動もこれを書く（02-first-run.md を参照）。変更は次の起動で、最初に（「移動中」画面の裏で）フォルダをロックする前に適用する。移動は、フォルダの名前変更（同じドライブ）、各項目の名前変更、コピーのいずれかで行う。移動先の `.novira-moving` の記録で、途中で切れた起動が続きをできる。古いファイルを消すのは、ポインタが移動先を指した後だけ。移動先には他のものがあってもよいが、データの名前（大文字小文字を区別しない）を 1 つも含んではならず、古いフォルダは空いていなければならない。失敗したら古いフォルダを使い続け、理由を残す（`dataDirNote`）。`comfyuiInstallDir`（`settings.json` のキー、起動時に読む）が自前の ComfyUI の場所を決める。フォルダは空か、既にインストールを含んでいなければならず、何も移動しない。そのダウンロード途中のファイルは一覧に出さない。

起動時と異なる変更は `restartNeeded` を立て、画面が次の起動で適用されると伝える。モデルフォルダは起動時にだけ読む。

**エンジンのコマンド。** `engine_settings` は `EngineSettings`（`backend/crates/novira-core/src/types.rs`）を返す。`set_engine_settings` は `EngineSettingsPatch` を受け取り、何かを書く前にすべての値を検査する（`backend/crates/novira-core/src/service/engine_settings.rs`）。`add_model_root` はシェルのダイアログからフォルダを受け取り、キャンセルされたら `null` を返す。`remove_model_root` は添字を受け取る。ダイアログのないブラウザサーバーでは、「フォルダを追加」とバックアップのボタンが、デスクトップアプリが要るという注記に置き換わる（`hasNativeDialogs`）。フォルダの削除は引き続きできる。

**パッケージの変更。** `comfyuiPackage` が変わった次の起動で、別のパッケージのインストールは、保存されたパッケージの同じ ComfyUI バージョンに置き換わり、拡張機能も入れ直される。起動しないときは古いものに戻る（`backend/crates/novira-core/src/comfy/client.rs`）。詳細は 02-extensions.md。

**低メモリモード**（`backend/crates/novira-core/src/service/memory.rs`、`backend/crates/novira-core/src/comfy/process.rs`）。スイッチは設定: 生成にある（`low_memory_mode`、`set_low_memory_mode`）。変更すると `lowMemoryMode` を保存する。novira の ComfyUI が動いていてジョブが進行中でなければ、`--novram` で再起動する。これは `comfyuiArgs` の VRAM フラグを置き換える（`--cpu` のときは使わない）。それ以外は次の起動で適用する。novira が ComfyUI を起動しないとき（`comfyuiUrl` だけ設定されているとき）は、設定を保存するだけで効果はなく、画面がそう伝える。メモリ不足で失敗したあとは、トーストがこのスイッチを勧める（`frontend/src/state/outOfMemory.ts`）。

**未完了のダウンロード**（`backend/crates/novira-core/src/unfinished.rs`、設定: データ）。一覧は、途中のファイル（`<name>.part`）ごとに残るバイト数を示す。探すのは `comfyui/.downloads`、`comfyui/.tools`、`models/trustmark`、そして `models/` の下で最大 4 階層までの各 `.downloads` フォルダ。`.resume` の記録は、途中のファイルが無いときだけ一覧に出る。行の削除は即座で、「すべて削除」は先に確認。実行中のダウンロードは自分の途中ファイルを保持する（`unfinished::hold`）。

**画面の状態**（`novira.*` のキー）はデータベースにも保存され、開いている他のページが即座に追従する。[03-ui-state-sync.md](../02-screens/03-ui-state-sync.md) を参照。

**保存したページ状態のリセット**（`frontend/src/state/uiState.ts`、設定: データ）。確認のあと、ブラウザストレージの一部を消す:`settings`（`novira.settings`、メモリ上は即座に戻す）、`generation`（`novira.params`）、`gallery`（`novira.gallery`）、`assistant`（`novira.agent`）、`all`（`novira.` のすべてのキー）。それ以外の範囲は再読み込みが必要で、画面が提案する。

**バックアップと復元**（`backend/crates/novira-core/src/backup/`、`backend/crates/novira-core/src/service/backups.rs`、`frontend/src/features/settings/BackupSection.tsx`）。

- 作成（`create_backup`）: ページの `novira.` キーを `ui-state.json` として入れ、保存先はシェルが尋ねる。zip の中身は、`manifest.json`（形式 `novira-backup`、バージョン 1、アプリのバージョン、時刻、件数）、`novira.sqlite`（`VACUUM INTO` のコピー）、そのコピー内の各画像の `outputs/<name>`、`thumbnails/<stem>.thumb`。`.zip.partial` として書き、完成したら名前を変える。モデル、ComfyUI、キャッシュ、ログ、`settings.json`、`agent.json`、`secrets/` は含めない。
- 復元（`open_backup`）: zip を検査し、データフォルダの `restore-staging` フォルダに展開する（境界を参照）。ページは日付と件数を示す。確定（`confirm_restore`）すると `READY` マーカーを書いて再起動し、キャンセル（`discard_restore`）すると展開した分を消す。
- 次の起動で、データベースを開く前に（`restore::apply_pending`、呼び出しは `backend/crates/novira-core/src/service/mod.rs`）: データベース（WAL と SHM を含む）、`outputs/`、`thumbnails/` を `backup-before-restore-<date>` に移し、展開済みのものを移し入れ、新しいテーブルを読む。失敗したら両方を元に戻す。成功したら古いフォルダを消し、そのあと `READY` を消す。各ステップは名前の変更 1 回で、状態はフォルダと `APPLYING` ジャーナル（古いフォルダの名前）から読むので、途中で切れた起動は次の起動が完了させる。ページは保存状態を 1 回受け取り（`take_restored_ui_state`）、再読み込みする。

**About ダイアログ**（`frontend/src/features/settings/AboutModal.tsx`）。両タブとも高さは同じ。ライセンスのタブは `LICENSE` の全文を示す。オープンソースのタブは `ossLicenses.json` とインストール済みの拡張機能を名前とバージョンで一覧し、部品や名前の検索で絞れる。各行は、`THIRD_PARTY_NOTICES.txt` から `ossTexts.ts` が読んだライセンス文をその場で示し（アプリが後でダウンロードするソフトウェアと拡張機能には無いので、その行はホームページを案内する）、ホームページは `open_source_page` で開く（受け付けるサイトは 04-browse.md）。

**利用者が選ぶファイル。** ファイルやフォルダが要るコマンドは、シェルの中でネイティブダイアログを開く（`backend/src-tauri/src/dialogs.rs`、rfd）。対象は、追加のモデルフォルダ、バックアップと復元の zip、書き出しと透かしの確認（02-gallery-share.md を参照）。

## 境界

| 境界 | ガード |
|---|---|
| エンジン設定（`engine_settings`、`set_engine_settings`、`add_model_root`、`remove_model_root`） | 変えられるのは、ComfyUI のパッケージ、起動のタイムアウト、Civitai 照会のスイッチ、追加のモデルフォルダだけ。`comfyuiUrl` と `comfyuiDir` は読み取り専用で表示し、Python、引数、GPU ロックは一切表示しない。パッチは未知のフィールドを拒否する。パッケージは `nvidia` か `amd`、タイムアウトは 30 から 1800 秒の整数で、何かを書く前にバックエンドで検査する（`settings::check_package`、`check_start_timeout`）。モデルフォルダは、`add_model_root` の中でシェルが開くダイアログからだけ来て（ページはパスを送らない）、再度検査する（`settings::check_new_model_root`）: 絶対パス、`..` なし、制御文字やデバイスパスなし、既存のフォルダ、まだ一覧にない（解決後、Windows では大文字小文字を区別しない）、データフォルダでもその中でもない、最大 16。`remove_model_root` は保存済みの一覧への添字だけを受け取る。変更はすべて `Settings::save_key` を通り、次の起動で適用される。パッケージを変えると、設定での確認のあと次の起動で、初回インストールと同じ公式アドレスから ComfyUI を入れ直す。 |
| 未完了のダウンロード（`list_unfinished_downloads`、`delete_unfinished_downloads`、`unfinished.rs`） | novira のダウンロードフォルダの途中のファイル（`<name>.part` とその `.resume` の記録）だけを一覧する。対象は `comfyui/.downloads`、`comfyui/.tools`、`models/trustmark`、`models/` の下で最大 4 階層までのすべての `.downloads` フォルダ。削除は一覧が返した相対パスで項目を指定する。一覧に無いパスは無視し、データフォルダにも連結しないので、それらのフォルダの外は削除できない。ダウンロードが今書いている途中ファイルは保持して残す（`unfinished::hold`、`download_with_stall` と透かしの取得が取る）。パスは最大 1000 件、各 512 文字まで、制御文字なし（`check_picked`）。フォルダを探すときリンクはたどらない。 |
| 利用者が選ぶファイル（共有用の書き出し、バックアップ、復元） | シェルがコマンドの中でネイティブダイアログを開く（rfd、ダイアログプラグインなし）。WebView はパスを送らず受け取らない。「フォルダを開く」は、シェルが自分の直近の書き出しから覚えているフォルダだけを開く。 |
| バックアップ zip の復元 | すべてのエントリ名が、バックアップを構成する正確な名前のどれか（`manifest.json`、`novira.sqlite`、`ui-state.json`、`outputs/<valid name>`、`thumbnails/<valid stem>.thumb`）でなければならない。絶対パス、`..`、ドライブ文字、バックスラッシュ、シンボリックリンク、重複があれば、何かを書く前に zip 全体を拒否する。エントリはサイズ制限つきで `restore-staging/` の中だけに展開する。マニフェストのバージョンとデータベースを検査する。データの置き換えは次の起動で、ロールバックつきで行う。バックアップに `secrets/` と `settings.json` は含まれない。 |

## 既知の限界

- バックアップ zip は画像、プロンプト、画面の状態を暗号化せずに持ち、ファイルを手に入れた人は読める。API キーは入らない。
- 未完了のダウンロードは、再開できるよう止めても途中ファイルを残すので、利用者が削除するまでディスクに残る。他のプログラムが開いている途中ファイルは削除できないことがあり、そのときは残って一覧に再び出る。
- ローカルモデルの Civitai 照会（`civitaiLookup`、既定はオフ）は、各モデルファイルの SHA-256 を Civitai に送り、Civitai の API キーが保存されていればそれも送る。オンにするのは利用者の同意で、次の起動で適用される。

## 未実装

- 設定画面からの ComfyUI のインストールと再インストール（無いときはアプリが自前のコピーをインストールする）。
- 画面からの `comfyuiUrl`・`comfyuiDir`・`comfyuiPython`・`comfyuiArgs`・`gpuLock` の編集（`settings.json` でだけ変える）。
