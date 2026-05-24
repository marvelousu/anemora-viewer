# anemora-viewer

iPhone 向け閲覧専用 PWA。`marvelousu/anemora` (Unity ゲームプロジェクト、public) の進捗を外出中に確認するための個人用ビューア。

- 仕様: [SPEC.md](./SPEC.md)
- 技術スタック: Astro + React island + Tailwind CSS + PhotoSwipe v5 + Framer Motion + Pagefind + @vite-pwa/astro
- ホスティング: Cloudflare Pages（認証なし）
- 開発環境: Linux（Mac 不要）

## 開発

```bash
npm install
npm run dev      # ローカル開発サーバ
npm run build    # 本番ビルド
```

## デプロイ

Cloudflare Pages の Deploy Hook を Anemora repo の webhook に登録。Anemora への push で自動再 build。

詳細は [SPEC.md](./SPEC.md) を参照。
