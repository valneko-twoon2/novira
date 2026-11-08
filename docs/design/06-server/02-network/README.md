# ネットワーク越しのスマホ

ブラウザ用サーバーを、家庭内ネットワークや外出先（Tailscale 経由）のスマホに開く形。リスナーの条件、ペアリングと承認、デスクトップアプリでの動作を扱う。

| ページ | 内容 |
|---|---|
| [01-browser-server-lan.md](01-browser-server-lan.md) | 家庭内ネットワークのブラウザ用サーバー（必要なときに開く）: TLS のみのリスナーとローカル CA、応答する相手、サブネットの検査 |
| [02-browser-server-pairing.md](02-browser-server-pairing.md) | スマホと家庭内ネットワークのリスナーのペアリング: ペアリングコードと QR、スマホのページ、この PC での承認、セッションとその限界 |
| [03-browser-server-remote.md](03-browser-server-remote.md) | 外出先のスマホ（Tailscale 経由）: Tailscale の証明書を使うリモートのリスナー、ペアリング後の passkey 登録、それでのサインイン、ログ、使われないときのオフ |
| [04-browser-server-app.md](04-browser-server-app.md) | スマホとデスクトップアプリ: 家庭内ネットワークとリモートのリスナーがアプリの中で動くこと、ウィンドウの `lan_*` と `remote_*` コマンド、組み込みのページと画像 URL |
