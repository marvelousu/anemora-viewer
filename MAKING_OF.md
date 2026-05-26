# anemora-viewer — Making Of

> 2026-05-24 〜 2026-05-25 にかけて、ユーザー (作者) と Claude Code の対話だけで「iPhone から個人ゲーム開発プロジェクトの進捗を外出中にブラウジングできる PWA」をゼロから作って Cloudflare Pages にデプロイ、AGENTS.md と PR check の運用ルール明文化まで終えた一連の記録。

---

## 0. TL;DR

- Anemora (HD-2D 探索アクション、`marvelousu/anemora`、Unity) の進捗を **iPhone Safari の Standalone PWA** で見たい、という日常の不便から始まったツール
- スタック: Astro 5 + React 18 island + Tailwind + PhotoSwipe v5 + Framer Motion + Pagefind + Workbox
- ホスティング: Cloudflare Pages (`anemora-viewer.pages.dev`)、認証なし、検索エンジン非掲載
- 仕様策定 → 実装 → デプロイ → iPhone 動作確認 → 運用ルール明文化 → PC 対応、まで一連を **対話形式の合意ベース** で進めた
- 並行作業中の Codex セッションが運用ルール (docs/review/<ISO>/ + devlog.txt) を翌日には自然に運用開始

---

## 1. 出発点 (2026-05-24 朝)

ユーザーの最初の発言:

> githubのスマホアプリでAnemoraの各セッションの進捗確認を外出中に行なっていますが、アプリ版はファイルのソートも画像ファイルのスライドによるプレビューもできず非常に使いづらいです。解決できるアプリなど作れますか？まずはプランモードで手法を検討したいです。

ここから Plan mode に入り、対話だけで設計を進める方針が確立した。

### 最初に確認した前提

- 普段の閲覧端末: iPhone (Working Copy で notes 同期は経験あり)
- 主要コンテンツ: Markdown ドキュメント + 画像スライド/ギャラリー
- 工数は度外視、新規アプリも視野
- ネタバレは GitHub にすでに置いている前提なので、外部公開は気にしない
- スマホ UX を極めたい

---

## 2. Plan モードでの 5 案比較

Plan agent に詳細プランを作らせて、ユーザーと一緒に比較表で評価。

| 案 | 安全 | UX | 必要環境 | 月額 |
|---|---|---|---|---|
| A. Working Copy + Obsidian チューニング | ★★★ | ★★ | iPhone のみ | $0 |
| **B. 静的 PWA + Cloudflare Pages + Access** | ★★★ | ★★★★ | iPhone + CF | $0 |
| C. 動的 Web (GitHub API + Workers) | ★★ | ★★★★ | iPhone + CF + PAT | $0 |
| D. iOS ネイティブ (Swift) | ★★★★ | ★★★★★ | **Mac + Xcode** | App Store 配布なら $99/年 |
| E. 自宅 PC + Tailscale | ★★★★ | ★★★ | 自宅 PC を 24h 起動 | $0 |

ユーザーが「スマホ UX を極めたい」と言ったので、D iOS ネイティブの可能性を深堀り。「Mac を持っていないがネイティブを作れるか」を確認した結果、Expo (React Native + EAS Build) / Flutter / PWA 強化 の 3 経路を提示し、最終的に **B' PWA 強化路線** に決定（Mac/Apple Developer Program 不要、無料、UX はネイティブの 7-8 割）。

---

## 3. 仕様策定 — 細部を AskUserQuestion で詰める

Plan agent に一括プランを書かせるのではなく、**論点ごとに 1-3 つの AskUserQuestion** に分けて、選択肢を中立に提示して確定させる方式を取った。これは Anemora 設計対話で蓄積した memory feedback (`feedback_anemora_no_premature_lockin`「複数案並列維持、早期確定誘導しない」) の運用を viewer 設計でも適用した形。

### Round ごとの確定

| Round | 論点 | 確定 |
|---|---|---|
| 1 | 方式 | B' PWA 強化、Mac 不要、無料 |
| 2 | ホスティング + スタック | Cloudflare Pages (認証なし) + Astro + React island + Tailwind |
| 3 | リポ構造 + 更新トリガ | 別 repo `anemora-viewer`、Deploy Hook + Anemora webhook |
| 4 | 画面構成 + branch 追従 | 起動時 = branch 選択 Home、下部 2 タブ (Gallery/Docs)、main 除外、work/* かつ 30日以内 commit を自動取得 |
| 5 | branch カード + Gallery 単位 + 切替動線 | カードに最終 commit/サムネ、ディレクトリ単位アルバム、Top bar dropdown |
| 6 | Docs Pin + Recent + 検索 | 手動 ★ Pin (localStorage)、Recent タブ不要、Pagefind で current branch のみ |
| 7 | PWA + テーマ + md 内画像 | 訪問済みのみキャッシュ、テーマユーザー切替、md 内画像 inline サムネ + PhotoSwipe |
| 8 | グリッド列数 + ソート初期 | 3 列、Tree / Updated / Name、デフォルト Tree (後で Updated に変更) |

### 仕様書を書き出す

ユーザー「プランを仕様書に起こした上で取り組んでください」を受けて `SPEC.md` (約 360 行) を書き出し。機能要件・データモデル・URL ルーティング・ビルドパイプライン・受け入れテスト 18 項目まで含めて、後で誰が読んでも実装できる粒度に。

---

## 4. 実装フェーズ

### 4.1 Content pipeline の落とし穴

最初は **sparse-checkout** で必要パスだけ取り込もうとした:

```bash
git clone --shared --no-checkout RAW dest
git -C dest sparse-checkout init --no-cone
echo "/*.md\n/docs/**\n/Assets/Art/**" > .git/info/sparse-checkout
git -C dest checkout SHA
```

結果は **ファイル 0 件**。原因は `--shared` clone が `refs/remotes/origin/*` をコピーしない仕様 + sparse-checkout が `init` のあとの直接書き換えで適用されない挙動。

**`git archive | tar` に切り替えて解決:**

```bash
git -C RAW archive --format=tar SHA -- 'docs' 'Assets/Art' 'Assets/UI' ':(glob)*.md' | tar -x -C dest
```

これで pathspec で必要パスのみを取り出し、tar で展開。`filter=blob:none` clone でも blob は archive 時に lazy fetch される。

### 4.2 Content collection

`scripts/collect-content.mjs` が:
- 各 branch ディレクトリで md / 画像 / Unity binary (.meta/.fbx/.mat...) を分類
- sharp で 512px webp サムネ生成 (3,184 枚 / 約 58MB)
- 原寸を `public/originals/<branch>/<path>` にコピー (約 1.8GB)
- `git log` で各ファイルの最終更新日 + 直近 7日 touched count
- `src/data/branches.json` を出力 (約 3.7MB)

`src/pages/index.astro` で `branches.json` を全量 import したら HTML が 4MB を超え PWA cache 上限に当たった → **Home には summary フィールドだけ map** することで 13KB に圧縮。

### 4.3 PWA cache を 50MB 以内に

iOS Safari の Service Worker キャッシュ上限が ~50MB。初期は **HTML 全部 + assets** が precache に入って 54MB を超えた。`globPatterns` を絞って index/404/offline + `_astro/**/*.{js,css}` + icons だけに → **420KB に削減**。各ページは runtime caching の NetworkFirst で取る形に。

---

## 5. デプロイ — API token + GitHub App の組み合わせ

ユーザー「API設定したらあなたが設定できますか？」 → はい、可能。

| 私が API でやる | ユーザーがブラウザでやる |
|---|---|
| Cloudflare Pages project 作成 | Cloudflare API token 発行 |
| GitHub source 設定 | Cloudflare Pages GitHub App を anemora-viewer に install |
| Build command / output / NODE_VERSION | (それだけ) |
| Deploy Hook URL 生成 |  |
| Anemora repo webhook 登録 (`gh api -X POST`) |  |

初回 build はキューイング 8.5 分 + 実 build 4.5 分 = 約 13 分。以降は warm runner で 5-7 分。

---

## 6. iPhone 動作確認とユーザーフィードバック

`https://anemora-viewer.pages.dev/` が live になってからのフィードバック → 即修正のサイクル。

### 6.1 「特定のアルバムをピンしたい、検索したい」

`PinButton` を `kind: 'doc' | 'album'` で一般化、`GalleryAlbumList` に検索 box (substring match) と Pinned section を追加。

### 6.2 「ホーム/Review タブを追加、devlog 連携、横スワイプ、Review をデフォルト」

下部タブを **2 → 4 (Review default / Home / Gallery / Docs)** に拡張。Home は Pinned albums + Pinned docs を集約。Review は `docs/review/*` のみ表示。Album 詳細に **`devlog.txt` から devlog 案内 pill** を表示し、タップで Docs タブの該当 md にジャンプ。

### 6.3 横スワイプの試行錯誤

ユーザーの「2 回スワイプするとそれ以上できない」を解決するまで 4 回コミットが要った:

1. `touchstart` / `touchend` (React onTouch*): 動作不安定
2. `Pointer Events` + `touch-action: pan-y`: **live JS には反映されたが iOS で発火せず**
3. **native `addEventListener` + `passive: false`**: 動いたが 2 回で詰まる
4. **`pageshow` listener で bfcache 復元時 `location.reload()`**: 解決

並行して **下部固定の prev/next ボタン bar** を追加（h-12、画面幅半分ずつ）— スワイプが動かなくてもタップで切り替えられる安全弁として永続化。

### 6.4 「context-aware prev/next」

ユーザー「Galleryで Assets/Art/Sprites/Hero を開いて next を押すと別ディレクトリへ行く」→ album path が `docs/review/*` 内なら review 内で前後、それ以外なら全 album 内で前後、と自動切り替え。

---

## 7. 運用ルール明文化 — 全セッションへの徹底

ユーザー「運用方法を対話式で策定し、anemora全セッションに徹底してもらいます」。

### 確定した運用

- `docs/review/<YYYY-MM-DDTHH-MM>/` (JST、ISO 8601、URL safe で `:` を `-`)
- 1 セッション = 1 サイクル、画像枚数の上限なし
- `devlog.txt` 必須、1 行目に対応 devlog markdown のリポ相対パス、`#` でコメント可
- 既存 `docs/devlog/screenshots/` (Codex の作業ログ) と並存

### CLAUDE.md → AGENTS.md 改名

ユーザー「作業セッションは codex ですが、CLAUDE.md で大丈夫ですか？」→ Codex 公式は `AGENTS.md` を推奨。**ファイル名を AGENTS.md に統一**してすべてのエージェントが同じ source を読むよう。

### PR check workflow

`.github/workflows/review-check.yml` + `.github/scripts/validate-review-dirs.py` で以下を validate:
1. ディレクトリ名が ISO 8601 (`YYYY-MM-DDTHH-MM`)
2. `devlog.txt` 存在
3. devlog.txt の最初の非空・非コメント行が実在する `docs/devlog/*.md` を指す
4. ディレクトリに画像が 1 枚以上

### 全 branch に配布

main に commit → 5 つの work branch に `cherry-pick` で個別配布 (`map-vs` だけ並列セッションの push と競合したので一度 reset して再 cherry-pick で対応)。CLAUDE.md は同じ commit で `git rm`。

### 副次効果: 翌日には Codex が運用開始

翌日確認したら、Codex セッションが既に **`docs/review/2026-05-25T01-04/`** など複数の cycle ディレクトリを各 work branch に作って、`devlog.txt` も完璧に従って push していた。仕様策定 → 翌セッションで運用開始、というスピード。

---

## 8. PC 対応 — Responsive + Docs sidebar

ユーザー「これをPC版に拡張も可能ですか？」→ Astro + Tailwind なので同 URL で responsive 化が最小コスト。

| 領域 | iPhone | PC |
|---|---|---|
| Gallery グリッド | 3 列 | 3 → 4 → 6 → 8 → 10 列 (sm/md/lg/xl) |
| 全体幅 | フル | `max-w-screen-2xl` で中央寄せ |
| album 前後切替 | swipe + 下部 bar | + **← / → キー** |
| PhotoSwipe | タッチ swipe / pinch | マウスドラッグ + ホイールズーム (元から PC 対応) |
| Docs md ページ | 縦並び | **左 sidebar (DocsTree 常時表示) + 右 article** |

Docs sidebar は `hidden lg:block lg:sticky lg:top-12` で desktop だけ出現。モバイルでは従来通り。

---

## 9. 公開戦略

ユーザー「プロジェクトが動いていることの証左にもなりますし、積極的に作業中の内容は発信したい」。

- viewer URL は **誰でも HTTPS でアクセス可能** (Anemora repo がそもそも public なので追加リスクなし)
- **検索エンジン非掲載**: `public/robots.txt` で `Disallow: /` + `<meta name="robots" content="noindex, nofollow">`
- Anemora の README 冒頭に viewer URL の 1 行案内: **積極的に共有しつつ、search で勝手に拾われない**

```
> 進行中の作業（各 work branch の screenshots / docs / Markdown）を外出中でもブラウジングできる iPhone / PC 対応ビューア: <https://anemora-viewer.pages.dev/> 。詳細は [`docs/review/README.md`](docs/review/README.md)。
```

---

## 10. コミット時系列 (主要 14 件、UTC)

| commit | 時刻 | 内容 |
|---|---|---|
| `be82231` | 2026-05-24 08:47 | Initial scaffolding (Astro 5 + React + Tailwind + PWA) |
| `51f8e63` | 09:20 | Gallery / Docs / PWA shell / DEPLOYMENT.md |
| `3148b10` | 09:25 | Pagefind 検索 UI |
| `ea27570` | 14:38 | Gallery アルバム Pin + path 検索 |
| `5a7010d` | 15:18 | 4 タブ化 (Review default / Home / Gallery / Docs)、devlog 連携、横スワイプ |
| `78bcae9` | 15:39 | 横スワイプ修正 + ISO 8601 整形 |
| `d5e434c` | 15:52 | native touchmove listener |
| `51f90c1` | 16:07 | 下部固定 prev/next bar |
| `6c6c912` | 16:10 | context-aware prev/next (review vs gallery) |
| `e48dfc8` | 16:39 | bfcache 復元時 reload |
| `801d980` | 翌 01:49 | Responsive + Docs sidebar (PC 対応) |
| `86cde78` | 02:16 | デフォルトソートを Updated に |
| `a56e14c` | 02:42 | ソートチップ順 Updated / Tree / Name |
| `c4d78a7` | 03:23 | robots.txt + meta noindex |

---

## 11. 学び

### 11.1 対話式仕様策定 vs 一括プラン提示

最初は Plan agent に詳細プラン (850 語) を一括で書かせたが、ユーザーから「対話式で細かい仕様を私と確認しながら設計してください」とフィードバック。以降は **Round ごとに 1-3 個の AskUserQuestion** で確定する方式に切替。

- メリット: 各論点で「これでいい」を取れるので後戻りが少ない、ユーザーが選択肢を把握しやすい
- 既存の memory feedback (`feedback_anemora_no_premature_lockin` 等) との整合も取りやすい

### 11.2 iOS Safari の touch / pointer / passive listener の罠

- React の `onPointerMove` は default で passive (?) で、`preventDefault()` が効かない場面がある
- `addEventListener('touchmove', ..., { passive: false })` を `useEffect` で直接 attach するのが iOS で確実
- 横スワイプを wrapper 要素に attach、`touch-action: pan-y` で縦スクロールと両立
- それでも bfcache 復元時に state が固まる → `pageshow` で `e.persisted` を見て `location.reload()`

### 11.3 PWA precache サイズ

`@vite-pwa/astro` のデフォルト globPatterns が広すぎて 54MB precache になる。iOS Safari の SW 上限 50MB に当たる前に `globPatterns` を shell + assets だけに絞って **420KB** に。HTML ページは runtime cache (NetworkFirst) で取る形が iPhone 体験的にも良い。

### 11.4 sparse-checkout より git archive

`git clone --shared --no-checkout` + `sparse-checkout` の組み合わせは refs が伝播しない罠で動かなかった。`git archive --format=tar SHA -- <paths>` を `tar -x` にパイプする方が pathspec で範囲指定でき確実。`filter=blob:none` 下でも archive 時に blob が lazy fetch される。

### 11.5 Cloudflare Pages + GitHub App の認可フロー

初回だけブラウザでの OAuth フローが必要 (API では代行不可)。それ以降は完全に API 駆動で deploy 設定・Deploy Hook 発行・webhook 登録ができる。Anemora repo への push → Deploy Hook → CF 内で auto build → 数分で反映。

### 11.6 並列セッションとの協調

Claude (このセッション) が main に AGENTS.md を commit している間、Codex が work branch で同時に作業中。cherry-pick の途中で同じ branch が更新されて non-fast-forward push エラー → reset して再 cherry-pick で吸収。次の日には Codex が運用ルールを完璧に実践済み、というスムーズな伝播。

### 11.7 「公開するが検索されない」設計

Anemora repo は public、viewer も認証なし、ただし `robots.txt Disallow: /` + meta robots noindex。**URL を能動的に共有した相手だけがアクセスする**運用に。GitHub README から直接リンクするので、リポを見た人には自然に届く。

---

## 12. ファイル参照

- viewer repo: <https://github.com/marvelousu/anemora-viewer>
- 仕様書: [`SPEC.md`](./SPEC.md)
- デプロイ手順: [`DEPLOYMENT.md`](./DEPLOYMENT.md)
- 設計 plan (Claude Code の Plan file): `~/.claude/plans/elegant-spinning-haven.md`
- Anemora 本体 (source): <https://github.com/marvelousu/anemora>
- Anemora 運用ルール: <https://github.com/marvelousu/anemora/blob/main/docs/review/README.md>
- AGENTS.md (元 CLAUDE.md): <https://github.com/marvelousu/anemora/blob/main/AGENTS.md>

