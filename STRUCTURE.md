# Project Directory Structure

建設現場工程・請求管理システム「Construx」のディレクトリ構造案です。

```text
/src
  /components
    /auth         -- ログイン、ユーザー認証関連
    /dashboard    -- 社長・事務員用ダッシュボード（Recipe 1: Technical Dashboard）
      /projects   -- 現場一覧、詳細、シミュレーション
      /staff      -- 人材管理、日当設定
      /timeline   -- 請求期限タイムライン表示
    /mobile       -- 親方用モバイル報告画面（Recipe 8: Clean Utility）
      /report     -- 工数報告、写真アップロード
    /layout       -- ナビゲーション、サイドバー、共通レイアウト
    /ui           -- shadcn/ui コンポーネント
  /hooks          -- Supabaseデータ取得用カスタムフック (useProjects, useStaff, etc.)
  /lib            -- Supabaseクライアント、ユーティリティ (utils.ts)
  /services       -- 外部サービス連携 (CSV出力、画像圧縮など)
  /types          -- TypeScript型定義 (database.ts)
  /utils          -- 日付フォーマット、計算ロジック
  App.tsx         -- ルーティング定義
  main.tsx        -- エントリーポイント
```

## 主要な画面構成
1. **ログイン画面**: ロールに応じたリダイレクト。
2. **社長ダッシュボード**: 
   - 現場ごとの原価（工数×日当）集計。
   - 目標粗利率入力による請求額シミュレーション。
3. **事務員画面**:
   - 現場の期限をタイムライン形式で表示。
   - 確定済みデータのCSVエクスポート。
4. **親方モバイル画面**:
   - 現場選択、開始/終了ボタン。
   - カメラ起動、写真アップロード（1現場100枚制限のバリデーション）。
