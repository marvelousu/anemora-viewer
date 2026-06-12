# AGENTS.md — anemora-viewer

エージェント向けの運用知識。コードを読めば分かることは書かない。概要・スタックは README.md、仕様は SPEC.md。

## コマンド

| コマンド | 用途 | 注意 |
|---|---|---|
| `npm run dev` | ローカル開発サーバ (astro dev) | UI/レイアウト変更の確認はまずこれ |
| `npm run build` | フルビルド | content 収集→R2画像/サムネ→branches.json→アイコン→astro build→pagefind。**5〜10分かかる**。ネットワーク必須 (anemora clone + R2) |
| `npm run build:fast` | astro build のみ | 収集済み content/ を再利用。フロント変更の検証はこちらで十分 |
| `npm run check` | astro check (型検査) | 現状唯一の機械ゲート。自動テストは無い |
| `npm run preview` | dist のローカル配信 | ビルド後の動作確認 |

## 検証の境界

- 機械検証は `astro check` のみ。UI 変更は `dev` / `preview` での目視が必要
- iOS 固有 (ホーム画面 standalone 起動・オフライン・ピンチズーム) は iPhone 実機でしか確認できない。precache は iOS Safari の 50MB 上限対策で約 420KB に絞ってある — precache 対象を増やす変更は要注意
- デプロイは Cloudflare Pages (anemora への push が Deploy Hook を叩く、手順は DEPLOYMENT.md)。**デプロイ成否はローカルから機械確認できない** (CF ダッシュボード頼み)

## 運用上の罠

- **他セッションが自動コミットを入れる**: `chore: refresh <topic> review` 形式のコミットが Anemora のレビューサイクルから随時入る。push 前に必ず `git pull --rebase origin main`
- `scripts/setup-r2-images.mjs` はサムネを毎回全再生成する (sharp で数千枚、フルビルドが遅い主因)
- content/ と public/thumbs/ public/originals/ はビルド生成物。直接編集しない
- このリポは **public**。コミットに Co-Authored-By 等のトレーラーを付けない。公開して困る素材 (anemora 本体に無いもの) を content に足さない

## ドキュメントの正

- 開発コマンドの正はこのファイルと README.md。SPEC.md §5.1 は収集パイプラインの設計意図として参照 (細部は実装が先行している場合がある)
