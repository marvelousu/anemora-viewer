# Anemora Viewer 仕様書

Version: 0.1.0 (2026-05-24 初版)
Repository: `marvelousu/anemora-viewer` (private)
Live URL: TBD (Cloudflare Pages デプロイ後に決定)

---

## 1. 概要

### 1.1 目的
GitHub モバイルアプリで Anemora (`marvelousu/anemora`、Unity ゲームプロジェクト、public repo) の進捗確認を行う際、(1) ファイル一覧のソートができない、(2) 画像のスライド/ギャラリープレビューが弱い、という問題を解決する iPhone 向け閲覧専用 PWA。

### 1.2 利用者
- マロ（@marvelousu）本人のみ（個人レビュー用）。共同編集・コメント機能は想定しない。

### 1.3 主要機能
1. work/* prefix の Anemora ブランチを切り替えて閲覧
2. 各ブランチの画像をディレクトリ単位のアルバムでブラウズ、PhotoSwipe でフルスクリーンスワイプ
3. Markdown ドキュメントをツリーで一覧、★ で Pin、Pagefind で全文検索、`[[wikilink]]` 解決
4. iOS Safari でホーム画面追加して Standalone モード起動（ネイティブ風 UX）

### 1.4 非目的
- 編集機能（add/commit/push 等）は提供しない
- 認証は提供しない（Anemora が public のため不要）
- main ブランチの閲覧（公開済 immutable なので viewer 対象外）
- push 通知（iOS PWA の制約および本件要件外）

---

## 2. 用語定義

| 用語 | 定義 |
|---|---|
| **viewer** | このプロジェクトで作る Anemora 閲覧 PWA |
| **source repo** | Anemora 本体 `marvelousu/anemora`（public） |
| **active branch** | viewer の build 対象になっている branch（work/* かつ直近 30 日 commit あり） |
| **branch slug** | URL に使うブランチ名の正規化形式（`work/chapter1-continuation-20260520` → `chapter1-continuation-20260520`） |
| **アルバム** | Gallery 内で「同じディレクトリにある画像群」を 1 単位として扱う表示単位 |
| **Pin** | Docs 画面でユーザーが ★ をタップして上部に固定表示するファイル指定。localStorage に保存 |
| **build** | Cloudflare Pages 上で Astro が source repo の内容を取り込み静的サイトを生成する処理 |
| **Deploy Hook** | Cloudflare Pages が発行する build トリガ URL。POST で build 起動 |

---

## 3. システム構成

### 3.1 構成図
```
[Anemora repo]                          [viewer repo (anemora-viewer)]
 public                                  private
 ├─ work/*  ────push────┐                ├─ src/         (Astro/React)
 ├─ Assets/             │                ├─ scripts/     (collect-content.ts)
 ├─ docs/               │                ├─ .github/workflows/build.yml
 └─ *.md                │                └─ public/
                        │
                        │ Webhook (POST Deploy Hook)
                        │
                        ▼
                 [Cloudflare Pages]
                 ├─ build (Astro + Pagefind)
                 │   └─ git clone Anemora ─→ work/* filter ─→ collect ─→ astro build
                 └─ Static CDN
                        │
                        │ HTTPS
                        │
                        ▼
                    [iPhone Safari / PWA]
```

### 3.2 関連リソース
- **Anemora repo**: `git@github.com:marvelousu/anemora.git` (public)
- **viewer repo**: `git@github.com:marvelousu/anemora-viewer.git` (private、新規作成)
- **CDN**: Cloudflare Pages（無料枠、認証なし、月 500 build 以下）
- **検索 index**: Pagefind が build 時に各 branch ごとに生成

---

## 4. 機能要件

### 4.1 起動・ナビゲーション
- 初回アクセス時: branch 選択 Home (`/`) を表示
- 2 回目以降: 最後に開いた URL を Safari が保持（標準動作、localStorage 不要）
- 共通 Top bar: 戻るボタン（左）/ branch ドロップダウン（中央、Home 以外で表示）/ テーマ切替（右）
- 下部 Tab bar: Gallery（起動デフォルト）/ Docs（Home 以外で表示）
- 戻るボタンは履歴がある場合 `history.back()`、無ければ Home に戻る

### 4.2 branch 選択 Home
- URL: `/`
- 表示: 各 active branch を card で一覧
- card 要素:
  - 代表サムネ 1 枚（card 上部の 16:9 領域）
    - 抽出ロジック: 該当 branch の最終 commit で touched された画像のうち `Assets/Art/` 配下のものを優先、無ければ `docs/` 配下、無ければプレースホルダ
  - branch 名（フル、`work/chapter1-continuation-20260520`）
  - 最終 commit 日時（相対、`2 時間前` `3 日前`）
  - 最終 commit message（1 行 truncate、最大 60 文字）
  - 直近 7 日に touched されたファイル数（`+12 files`）
- 並び順: 最終 commit 日時の新しい順
- card タップで `/[branch-slug]/gallery` に遷移
- Framer Motion で初期フェードイン（200ms stagger 50ms）

### 4.3 Gallery 画面

#### 4.3.1 アルバム一覧 `/[branch-slug]/gallery`
- 各ディレクトリを 1 アルバムとして表示（画像が 0 枚のディレクトリは除外）
- アルバム card: ディレクトリ名（フルパス）/ 画像数 / 代表サムネ 1 枚（ディレクトリ内の最初の画像）
- レイアウト: 1 列（モバイル幅）の縦リスト
- デフォルトソート: ディレクトリ階層（パスの辞書順、深さ優先）
- ソート切替（top のチップ 3 つ）: ディレクトリ / 更新日 desc / アルバム名 asc

#### 4.3.2 アルバム詳細 `/[branch-slug]/gallery/[...album-path]`
- アルバム内画像のグリッド
- 列数: **3 列**（iPhone 縦持ち、`grid-cols-3`、aspect-square、`gap-1`）
- 各サムネ: 512px webp（lazy load、`loading="lazy"`、`decoding="async"`）
- サムネタップで PhotoSwipe フルスクリーン起動
- アルバム内ソート: ファイル名 asc 固定（モード切替不要、シーケンス画像の場合に自然順）

### 4.4 Docs 画面

#### 4.4.1 ツリー `/[branch-slug]/docs`
- 左ペイン（モバイルではハンバーガで展開）: フォルダ階層ツリー
- 右ペイン: Pin 一覧（★）+ 検索ボックス + ファイル一覧（フラット表示モード時）
- デフォルト表示: Pin 一覧（上）+ root の README.md があれば表示（下）
- Pin 一覧: localStorage の `viewer.pin.<branch-slug>` 配列の md ファイルを順に表示
- ★ アイコン: 各ファイル名の右側に表示、タップで Pin/Unpin 切替、localStorage 即時更新
- ソート切替（top のチップ 3 つ）: ディレクトリ / 更新日 desc / ファイル名 asc
- 検索ボックス: Pagefind UI、インクリメンタル絞り込み

#### 4.4.2 Markdown 表示 `/[branch-slug]/docs/[...path]`
- パンくず: 上部に `branch / docs / dir / file.md` を表示
- 本文: remark-rehype-shiki でレンダリング
  - コードブロック: shiki でハイライト（テーマは light/dark で切替）
  - 表: tailwind-typography で整形
  - `[[wikilink]]` は remark-wiki-link で解決し、`/[branch-slug]/docs/<解決先>` リンクに変換
  - 本文内 `![](path)` 画像: build 時に 512px webp サムネに差し替え、`<a>` でラップして PhotoSwipe で開く
- 右下 floating button: ★ Pin（このページを Pin/Unpin）
- 左右スワイプ: フォルダ内の前後ファイルに移動（オプション、Step 6 で実装判断）

### 4.5 PhotoSwipe 画像ビューア
- ライブラリ: PhotoSwipe v5
- 起動: サムネタップ、md 内画像タップ
- 操作: 左右スワイプで前後画像、ピンチズーム、ダブルタップでズーム、上下スワイプで閉じる
- フッタ: ファイル名 + 更新日（最終 commit 日）
- アルバム単位で連結（前後画像はアルバム内の隣接画像）
- md 内画像は単独表示（前後遷移なし）

### 4.6 テーマ切替
- 切替単位: light / dark
- 切替トリガ: Top bar 右端のアイコンボタン（太陽/月）
- 永続化: localStorage `viewer.theme` に保存
- 初期値: localStorage に値が無ければ `prefers-color-scheme` を読んで system に追従
- 実装: `<html>` 要素に `class="dark"` をトグル（Tailwind の dark variant 動作）

### 4.7 PWA 起動
- manifest.webmanifest: 
  - `name`: `Viewer`
  - `short_name`: `Viewer`
  - `display`: `standalone`
  - `theme_color`: light テーマと dark テーマで分け、media query 経由で切替
  - `icon`: 192px / 512px maskable + non-maskable の 4 種
- Apple touch icon: 180 / 152 / 120 / 76 px の 4 サイズ
- iOS ホーム追加導線:
  - 初回訪問 + iOS 検出 + display-mode が browser のとき、画面下部に半透明バナーで「ホーム画面に追加する手順」を案内
  - バナーには [×] 閉じるボタン、閉じた状態は localStorage に保存して二度表示しない
- Service Worker: Step 7 で詳述

---

## 5. 非機能要件

### 5.1 パフォーマンス
- 初回ロード: viewer URL アクセスから Home 表示まで 4G で 2 秒以内（Astro の静的 HTML が即届く）
- Gallery アルバム表示: タップから初回サムネ表示まで 1 秒以内
- PhotoSwipe 起動: タップから 300ms 以内（原寸ロード中はサムネを placeholder にする）
- Service Worker 経由の 2 回目以降のページ表示: 200ms 以内

### 5.2 オフライン
- 戦略: Service Worker の network-first (HTML/md/json) + stale-while-revalidate (画像/css/js)
- pre-cache はしない（軽量運用）
- 訪問済みページは機内モードでも表示される
- 未訪問ページにアクセスした場合は専用のオフラインフォールバックページ `/offline.html` を表示

### 5.3 セキュリティ
- 認証なし（Anemora が public のため）
- HTTPS のみ（Cloudflare Pages 自動）
- viewer URL に Anemora の物語/世界観固有の語彙を含めない（CLAUDE.md 規律準拠）
- ドメインは Cloudflare Pages のデフォルト (`anemora-viewer.pages.dev` 等) で十分（カスタムドメインは設定しない）
- `<title>` `meta description` `og:*` は `Viewer` 程度の最小情報のみ

### 5.4 ブラウザ対応
- 主要対象: iOS Safari 16+
- 副次対象: Chrome / Edge デスクトップ最新版（開発時用）
- 非対応: IE、Firefox iOS（Safari ベースなので動くが保証外）

---

## 6. データモデル

### 6.1 `src/data/branches.json`
build 時に `scripts/collect-content.ts` が生成。

```ts
type BranchesJson = {
  generatedAt: string;  // ISO 8601、build 時刻
  branches: Branch[];
};

type Branch = {
  name: string;              // "work/chapter1-continuation-20260520" フル名
  slug: string;              // "chapter1-continuation-20260520" URL 用
  lastCommit: {
    sha: string;             // 短縮 SHA (7 文字)
    date: string;            // ISO 8601
    message: string;         // commit message の 1 行目
  };
  touchedRecent7d: number;   // 直近 7 日に touched された file 数
  representativeImage: string | null;  // 代表サムネのサムネ URL
  albums: Album[];
  docs: DocFile[];
  unsupported: UnsupportedFile[];
};

type Album = {
  path: string;              // "Assets/Art/Sprites" 等のディレクトリパス
  imageCount: number;
  representativeThumb: string;  // 最初の画像のサムネ URL
  lastModified: string;      // アルバム内の最新更新日
  images: AlbumImage[];
};

type AlbumImage = {
  filename: string;          // "atlas_01.png"
  path: string;              // フル相対パス
  thumbUrl: string;          // "/thumbs/<branch-slug>/<path>.webp"
  originalUrl: string;       // "/originals/<branch-slug>/<path>"
  width: number;
  height: number;
  lastModified: string;      // ISO 8601
};

type DocFile = {
  path: string;              // "docs/STATUS.md" 等
  filename: string;          // "STATUS.md"
  category: "root" | "docs" | "docs/devlog" | "other";
  lastModified: string;
  sizeBytes: number;
};

type UnsupportedFile = {
  path: string;              // "Assets/Models/Hero.fbx" 等
  ext: string;               // "fbx", "mat", "ogg", "ttf"
  reason: string;            // "Unity binary" / "Audio" / "Font" 等
};
```

### 6.2 viewer ローカル状態 (localStorage)
| キー | 型 | 内容 |
|---|---|---|
| `viewer.theme` | `"light"` \| `"dark"` | テーマ選択 |
| `viewer.pin.<branch-slug>` | `string[]` | Pin された md ファイルのパス配列 |
| `viewer.ios-banner-dismissed` | `"1"` | iOS ホーム追加バナーを閉じたか |

### 6.3 静的アセット配置
```
public/
├─ thumbs/<branch-slug>/<path>.webp     ... サムネ (512px)
├─ originals/<branch-slug>/<path>       ... 原寸 (元 PNG/JPG/SVG をそのままコピー)
├─ icons/                               ... PWA アイコン
└─ manifest.webmanifest

dist/                                   ... Astro build 出力
└─ pagefind/<branch-slug>/              ... Pagefind index (branch ごと)
```

---

## 7. URL ルーティング

| Path | 内容 |
|---|---|
| `/` | branch 選択 Home |
| `/[branch-slug]/gallery` | Gallery アルバム一覧 |
| `/[branch-slug]/gallery/[...album-path]` | アルバム詳細 |
| `/[branch-slug]/docs` | Docs ツリー + Pin 一覧 |
| `/[branch-slug]/docs/[...doc-path]` | Markdown ファイル表示 |
| `/[branch-slug]/search?q=<query>` | Pagefind 検索結果 |
| `/offline.html` | オフラインフォールバック |
| `/404.html` | 404 ページ |

Astro の dynamic routes (`getStaticPaths`) で全 (branch × album) (branch × doc) を build 時に静的生成。

---

## 8. ビルドパイプライン

### 8.1 トリガー
- viewer repo への push: GitHub Actions が自動起動
- Anemora repo への push: webhook が Cloudflare Pages Deploy Hook URL を叩き、CF Pages 側で build 起動
- 手動: viewer repo の Actions タブから `workflow_dispatch` で起動可能

### 8.2 build スクリプト (`.github/workflows/build.yml` および CF Pages 側 build)
CF Pages の build command:
```bash
node scripts/setup-content.mjs && npm run build && npx pagefind --site dist --bundle-dir pagefind
```

`scripts/setup-content.mjs` の動作:
1. `git clone --no-checkout https://github.com/marvelousu/anemora.git content/anemora-raw`
2. `git -C content/anemora-raw ls-remote origin 'refs/heads/work/*'` で work branch 一覧取得
3. 各 branch について `git log -1 --format=%ct origin/<branch>` で最終 commit unix time を取得、現在時刻との差が 30 日以内のもののみ残す
4. フィルタ後の各 branch を `content/branches/<branch-slug>/` に sparse checkout
   - sparse pattern: `Assets/**/*.{png,jpg,jpeg,webp,svg,gif}` `docs/**/*` `*.md`
5. `scripts/collect-content.ts` を実行
   - `branches.json` を `src/data/` に生成
   - サムネ webp を `public/thumbs/<branch-slug>/<path>.webp` に生成 (sharp、512px、quality 80)
   - 原寸を `public/originals/<branch-slug>/<path>` にコピー

### 8.3 Astro build
- `npm run build` 実行
- `getStaticPaths` で全 branch × 全 album × 全 doc を展開
- 出力: `dist/`

### 8.4 Pagefind index 生成
- build 後に `npx pagefind --site dist --bundle-dir pagefind`
- branch ごとに `dist/pagefind/<branch-slug>/` に index 生成（Pagefind の `--site` を branch 単位で実行する設定にする）
- index サイズ目標: branch あたり 1MB 以下

### 8.5 build 時間目安
- branch 5 本 × 平均 100 画像 × サムネ生成 = 約 1-2 分
- Astro build = 約 30 秒
- Pagefind index = 約 30 秒
- 合計: 2-3 分

---

## 9. デプロイ・更新フロー

### 9.1 初回セットアップ手順
1. viewer repo 作成 (`gh repo create marvelousu/anemora-viewer --private`)
2. Astro テンプレート + 依存 install
3. Cloudflare Pages プロジェクト作成、viewer repo を接続
4. CF Pages 環境変数 `ANEMORA_REPO_URL=https://github.com/marvelousu/anemora.git` 設定（public なので token 不要）
5. CF Pages Deploy Hook を生成、URL を取得
6. Anemora repo の Settings → Webhooks に Deploy Hook URL を登録（content type: application/json、event: push）

### 9.2 通常運用
- Anemora に push → webhook → CF Pages build → 2-3 分後に CDN 反映
- viewer 自体の改修は viewer repo に push → CF Pages 自動 build
- 古い branch が 30 日経過 → 次回 build から自動的に対象外
- 新規 work/* branch が push される → 次回 build から自動的に対象に追加

### 9.3 ロールバック
- CF Pages の Deployments タブから過去の build を「Rollback to this deployment」で即時復旧
- 設定変更が必要な場合は viewer repo の git revert + push

---

## 10. エッジケース処理

| ケース | 対応 |
|---|---|
| Unity binary (.fbx, .mat, .prefab, .asset, .blend) | viewer 取り込み対象外（sparse checkout で取り込まない） |
| 音声 (.ogg) | viewer 取り込み対象外 |
| フォント (.ttf, .otf) | viewer 取り込み対象外 |
| SVG | 画像扱い、PhotoSwipe で表示 |
| 巨大 PNG (10MB 超) | 警告ログを build に出力、サムネは webp 化で軽量、原寸はそのまま |
| 画像 0 枚のアルバム | アルバム一覧から除外 |
| docs 内画像の相対パス解決失敗 | build 時に warn、本文には alt text を表示 |
| Pagefind index 生成失敗 | 検索 UI を「現在検索利用不可」表示にフォールバック |
| 30 日以内 commit が 0 branch | Home に「アクティブなブランチがありません」を表示 |
| Anemora repo clone 失敗 | build 失敗、CF Pages は前回成功 build を維持 |

---

## 11. 受け入れテスト

### 11.1 機能テスト（iPhone Safari で実機確認）

| # | 項目 | 期待動作 |
|---|---|---|
| T1 | viewer URL アクセス | branch 選択 Home が 2 秒以内に表示 |
| T2 | branch card タップ | `/[branch-slug]/gallery` に遷移、Gallery 表示 |
| T3 | branch ドロップダウン切替 | URL の branch 部分が変わり、画面内容も更新 |
| T4 | アルバム一覧 → アルバム詳細 | 3 列グリッドでサムネが lazy load |
| T5 | サムネタップ | PhotoSwipe フルスクリーン起動、スワイプで前後 |
| T6 | PhotoSwipe ピンチズーム | 拡大、ダブルタップで切替 |
| T7 | Docs タブ | フォルダ階層ツリー、root README 表示 |
| T8 | ★ Pin タップ | localStorage 即時更新、Docs 上部の Pin 一覧に追加 |
| T9 | リロード後の Pin 保持 | localStorage から復元、Pin 一覧に表示 |
| T10 | Markdown 表示 | shiki ハイライト、表整形、`[[wikilink]]` 解決 |
| T11 | md 内画像タップ | PhotoSwipe フルスクリーン起動 |
| T12 | Pagefind 検索 | 検索ボックスに入力 → インクリメンタル絞り込み |
| T13 | テーマ切替 | light/dark 切替、localStorage 保存、リロード後保持 |
| T14 | ホーム画面追加 | Standalone モード起動、Safari URL バー無し |
| T15 | Anemora 1 commit push | 2-3 分以内に viewer に反映 |
| T16 | 機内モードで訪問済みページ | 表示される |
| T17 | 機内モードで未訪問ページ | `/offline.html` フォールバック |
| T18 | エッジケースファイル (.fbx 等) | viewer に出てこない |

### 11.2 デスクトップでの動作確認（開発時用）
- Chrome DevTools の Device emulation で iPhone 14 Pro を選び、全 T 項目を確認
- Lighthouse PWA score: 90+ 目標

---

## 12. 制約事項・ネタバレ管理

- Anemora は public repo だが、viewer の URL/ドメイン/タイトル/OG タグに Anemora の物語/世界観固有語彙（人名・地名・章名等）を含めない方針を維持（CLAUDE.md `feedback_anemora_no_spoiler_in_metadata` 規律）。
- viewer の Cloudflare Pages デフォルトドメインは `anemora-viewer.pages.dev`。`anemora` 自体は外向きに表出しても問題ない（Anemora 公式名なので）。
- viewer 内コンテンツ表示時はネタバレ語彙を当然そのまま表示する（レビュー目的のため）。
- 外部に viewer URL を共有する際は本人判断（仕様としては想定しない）。

---

## 13.5 Anemora source repo conventions for review workflow

The viewer now exposes a dedicated **Review** tab as the default landing tab on each branch. It lists album directories under `docs/review/`. To make this work, the source repo (`marvelousu/anemora`) follows these conventions:

### Directory naming

Each review cycle is its own timestamp directory under `docs/review/`:

```
docs/review/<YYYYMMDDHHMM>/
  image-01.png
  image-02.png
  ...
  devlog.txt        (optional)
```

Example: `docs/review/202605242351/`.

### devlog.txt (optional)

Plain text file. The first non-empty, non-comment line is treated as the path to the related devlog markdown. The viewer surfaces a "devlog" pill on the album header that opens the markdown on the Docs tab.

```text
# generated alongside the review images
docs/devlog/2026-05-24_chapter1_session_intro.md
```

### Effect in the viewer

- Each `docs/review/<cycle>/` becomes a card on the **Review** tab.
- Review is the default tab when opening any branch.
- If `devlog.txt` is present, the album detail page shows a clickable "devlog:" pill.
- On the album detail page, **swiping left/right** (≥80 px horizontal, dominant over vertical) moves to the previous/next album in path order. The header also shows prev/next text links as fallback.
- Pinning still works in the same way: tap ★ on a card to pin it (per device, localStorage), and pinned items show up in the **Home** tab alongside pinned docs.

## 14. 残課題・将来拡張

- 全文検索の全 branch 横断（現状は current branch のみ。Pagefind の multi-site index 機能を使えば実現可能）
- 動画 (.mp4) 対応（Anemora が今後動画を持つようになったら検討）
- 編集機能（viewer は read-only、編集は Working Copy or GitHub Web で）
- コラボレーション機能（個人用のため不要）
- offline 用 pre-cache モード（必要に応じて future task）
- カスタムドメイン（必要が無ければ pages.dev のままで十分）

---

## 付録 A: ファイル一覧（viewer repo の構成）

```
anemora-viewer/
├─ SPEC.md                            ... 本ファイル
├─ README.md
├─ package.json
├─ astro.config.mjs
├─ tailwind.config.mjs
├─ tsconfig.json
├─ .gitignore
├─ .github/workflows/build.yml        ... viewer repo CI
├─ scripts/
│   ├─ setup-content.mjs              ... Anemora clone + branch filter
│   └─ collect-content.ts             ... content 列挙 + サムネ生成 + JSON 出力
├─ src/
│   ├─ pages/
│   │   ├─ index.astro                ... branch 選択 Home
│   │   ├─ [branch]/
│   │   │   ├─ gallery/
│   │   │   │   ├─ index.astro        ... アルバム一覧
│   │   │   │   └─ [...album].astro   ... アルバム詳細
│   │   │   ├─ docs/
│   │   │   │   ├─ index.astro        ... Docs ツリー + Pin 一覧
│   │   │   │   └─ [...slug].astro    ... md 表示
│   │   │   └─ search.astro           ... Pagefind 検索結果
│   │   ├─ offline.astro
│   │   └─ 404.astro
│   ├─ components/
│   │   ├─ TopBar.tsx                 ... React island
│   │   ├─ BranchDropdown.tsx
│   │   ├─ ThemeToggle.tsx
│   │   ├─ AlbumGrid.tsx
│   │   ├─ PhotoSwipeProvider.tsx
│   │   ├─ DocsTree.tsx
│   │   ├─ PinButton.tsx
│   │   ├─ PagefindSearch.tsx
│   │   └─ IOSAddToHomeBanner.tsx
│   ├─ layouts/
│   │   ├─ BaseLayout.astro
│   │   └─ BranchLayout.astro
│   ├─ data/
│   │   └─ branches.json              ... build 時生成
│   └─ styles/
│       └─ globals.css
└─ public/
    ├─ manifest.webmanifest
    ├─ icons/
    ├─ thumbs/                         ... build 時生成
    └─ originals/                      ... build 時生成
```
