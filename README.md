# 名刺ビューア

Googleスプレッドシートの名刺一覧を、スマホでカード表示・検索するPWAです。
シートは非公開のまま、Googleログインした本人だけが読み込めます(読み取り専用)。

## Google Cloud 設定

1. https://console.cloud.google.com/ で新しいプロジェクトを作成(例: `meishi-viewer`)
2. 「APIとサービス」→「ライブラリ」→ **Google Sheets API** を有効化
3. 「APIとサービス」→「OAuth同意画面」(Google Auth Platform)
   - アプリ名・サポートメールを入力、対象(User type)は **外部**
   - 「対象」→ テストユーザーに自分のGmailを追加(公開ステータスは「テスト」のままでOK)
4. 「認証情報」→「認証情報を作成」→「OAuthクライアントID」
   - 種類: **ウェブアプリケーション**
   - 承認済みのJavaScript生成元:
     - `http://localhost:8080`
     - `https://<GitHubユーザー名>.github.io`
   - 作成後に表示される **クライアントID** を控える

## 設定ファイル

`config.js` に以下を記入:

- `CLIENT_ID`: 上で作成したクライアントID
- `SPREADSHEET_ID`: シートURL `https://docs.google.com/spreadsheets/d/<ここ>/edit` の部分
- `SHEET_NAME`: シート(タブ)名

`CLIENT_ID` が空の場合はデモデータで表示します。

## ローカル実行

```bash
npx http-server@14.1.1 . -p 8080 -c-1
```

## スマホで使う

GitHub Pagesで公開し、Android Chromeで開いて「ホーム画面に追加」。
