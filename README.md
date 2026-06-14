# anemora-viewer

iPhone / PC 向けの閲覧専用 PWA。Unity HD-2D 探索アドベンチャー [`marvelousu/anemora`](https://github.com/marvelousu/anemora) の各 `work/*` / `wip/*` branch の進捗 (`docs/review/<日時>/` 画像、`docs/devlog/*.md`、Markdown ドキュメント) を、外出中の iPhone やデスクトップから一画面で追えるように作ったツールです。

- Live URL: <https://anemora-viewer.pages.dev/>
- 仕様: [SPEC.md](./SPEC.md)
- 制作過程 (対話ログ + 実装ノート): [MAKING_OF.md](./MAKING_OF.md)
- 紹介記事: [Claude Code で作った AI 生成アセットのレビュー用 4本 (Zenn)](https://zenn.dev/marvelousu/articles/anemora-dev-tools)

## 主な機能

- **Review タブ**: 各 work branch の `docs/review/<ISO日時>/` 配下のレビュー画像をサイクルごとに閲覧
- **Home タブ**: Pin した album と doc を集約
- **Gallery タブ**: ディレクトリ単位のアルバムを 3-10 列グリッドで表示 + PhotoSwipe 全画面ズーム
- **Docs タブ**: Markdown ドキュメントを Pagefind 全文検索つきで閲覧、`★ Pin` で記憶
- **branch dropdown** で work / wip branch を切り替え、`work/*` / `wip/*` かつ 30 日以内 commit の最新 branch を自動取得
- **iPhone 横スワイプ** で前後の album に移動 / **PC は ← / → キー**
- **テーマ切替** (sun/moon)、PWA 化 (ホーム画面追加で full-screen)

## スタック

- フロント: Astro 5 + React 18 island + Tailwind CSS
- 画像: PhotoSwipe v5 (zoom / swipe)、Framer Motion (transitions)
- 検索: Pagefind (静的フルテキスト)
- PWA: `@vite-pwa/astro` + Workbox (NetworkFirst の runtime cache、precache は 420KB に絞って iOS Safari 50MB 上限を回避)
- 画像処理: sharp (512px webp サムネ生成)
- ホスティング: Cloudflare Pages (認証なし、無料枠)

## 開発

```bash
npm install
npm run dev      # ローカル開発サーバ
npm run build    # 本番ビルド (collect-content.mjs が src/data/branches.json と public/thumbs/, public/originals/ を生成)
```

`npm run build` は `marvelousu/anemora` を `content/` に clone し、`work/*` / `wip/*` branch から画像と md を抽出してサムネを生成します。既定では build size を抑えるため prefix ごとの最新 1 branch を対象にします。詳細は [SPEC.md](./SPEC.md) §5.1。

## デプロイ

Cloudflare Pages の Deploy Hook を Anemora repo の webhook に登録、Anemora への push で自動再 build。手順は [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 公開ポリシー

- viewer URL は誰でも HTTPS でアクセス可能 (anemora 本体も public のため追加のリスクなし)
- 検索エンジン非掲載: `public/robots.txt` で `Disallow: /` + `<meta name="robots" content="noindex, nofollow">`
- アクセス制御はかけていないので、URL が漏れれば誰でも見られる前提で、公開して困らない素材だけを載せる運用

## License

[MIT](./LICENSE)
