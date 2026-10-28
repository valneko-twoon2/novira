<!--
Template for the notes of a GitHub release. Copy everything below this comment into the release body and fill it in.

- The notes are for users, so they are in Japanese, in です/ます form. Name screens and buttons with the words the app shows (quote the ja catalog), not with code names.
- Gather the changes with `git log --oneline <previous tag>..HEAD`: `feat:` commits go to 新機能, `fix:` commits to 修正. Leave out changes a user cannot see (`docs:`, `chore:`, tests, the harness, refactors).
- 新機能: one `###` heading per feature that says what the user can now do (「〜できる」「〜に対応」). Under it, short lines: how to use it, defaults (「初期値は〜」), limits and numbers (days, counts). Group small related changes under one heading.
- 修正: one line per bug, 「〜する不具合を直しました」 or 「〜ようにしました」. Put several small ones into the last line, 「そのほか、〜などを直しました。」
- 既知の制限: what does not work yet or works only partly, and what the user can do about it. Keep the translation line while languages other than ja and en lag behind.
- Drop a section that would be empty.
-->

## 新機能

### （できるようになったこと）

（使い方・操作の場所。）
（初期値・上限・対象。）

### （できるようになったこと）

（説明。）

## 修正

- （〜する不具合を直しました。）
- （〜ようにしました。）
- そのほか、（細かい修正）などを直しました。

## 既知の制限

- （まだできないこと・一部だけのこと。）
- 新しい文言は、日本語と英語のみ翻訳済みです。ほかの言語は順次対応します。
