# Deployment

Target: **Cloudflare Pages** (no authentication, free tier).

The build pulls the latest content of `marvelousu/anemora` (public) at build time, so the only thing Cloudflare Pages needs to redeploy on Anemora changes is a Deploy Hook ping.

---

## 1. Initial setup (one-time)

1. Sign in (or sign up) at https://dash.cloudflare.com/.
2. Open **Workers & Pages → Create application → Pages → Connect to Git**.
3. Authorize Cloudflare to access **`marvelousu/anemora-viewer`** (this repo).
4. Configure the project:

   | Field | Value |
   |---|---|
   | Project name | `anemora-viewer` (resulting URL: `anemora-viewer.pages.dev`) |
   | Production branch | `main` |
   | Framework preset | **Astro** |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node.js version | 20 or later (set via env var `NODE_VERSION=20` if needed) |

5. Click **Save and Deploy**.
6. The first build takes 5–10 minutes (it clones Anemora, generates ~3,000 webp thumbnails via sharp, and emits ~2,500 static pages).

When the deployment finishes, open the URL on iPhone Safari. The home screen "Add to Home Screen" prompt appears automatically on the first visit (dismissible).

---

## 2. Auto-deploy on Anemora pushes

After the first successful deployment:

1. In **Cloudflare Pages → anemora-viewer → Settings → Builds & deployments → Deploy hooks**, click **Add deploy hook**.
2. Name: `anemora-push`. Branch: `main`. Save and copy the **Deploy Hook URL** (a `https://api.cloudflare.com/...` URL).
3. Register that URL as a webhook on the Anemora repo (push events). Either:

   **Using `gh` CLI:**
   ```bash
   gh api -X POST repos/marvelousu/anemora/hooks \
     -f name=web \
     -F active=true \
     -f 'events[]=push' \
     -F 'config[url]=<DEPLOY_HOOK_URL>' \
     -F 'config[content_type]=json'
   ```

   **Or via GitHub UI:** Settings → Webhooks → Add webhook → paste the Deploy Hook URL, content type `application/json`, individual events: `push` only.

After this, every push to `marvelousu/anemora` triggers a Cloudflare Pages rebuild within seconds. The viewer reflects the change in a few minutes (the bottleneck is the thumbnail generation step).

---

## 3. Manual rebuild

If you want to force a rebuild without pushing to Anemora (e.g., to test a viewer-only change):

- Push any commit to `marvelousu/anemora-viewer` (`main` branch). Cloudflare Pages auto-detects.
- Or trigger the Deploy Hook URL manually:
  ```bash
  curl -X POST '<DEPLOY_HOOK_URL>'
  ```

---

## 4. Verifying the deploy

| Check | How |
|---|---|
| HTTPS reachable | `curl -sI https://anemora-viewer.pages.dev` returns 200 |
| Branch cards visible on Home | open in Safari, scroll cards |
| Gallery loads | tap a branch → Gallery tab → tap any album → 3-col grid renders |
| PhotoSwipe works | tap any thumb → fullscreen swipe + pinch zoom |
| Docs render | tap Docs tab → any `.md` page renders with code highlight |
| Pin works | tap ★ on a doc → reload → still pinned |
| Theme toggle | tap sun/moon in top bar → swaps + persists across reloads |
| PWA install | Safari Share → Add to Home Screen → launches without URL bar |
| Auto-update flow | push a commit to a `work/*` or `wip/*` branch on anemora → wait ~3 min → reload viewer → new content appears |

---

## 5. Rollback

Cloudflare Pages keeps the last N deployments. From **Deployments**, pick any prior build and click **Rollback to this deployment**. Effective immediately on the live URL.

---

## 6. Limits / notes

- **Cloudflare Pages free tier**: 500 builds/month, 25 GB total storage, unlimited bandwidth. Each Anemora push triggers one build.
- **Build duration**: 5-10 min. Hard timeout is 20 min on free tier; the default build tracks the latest branch per prefix (`MAX_BRANCHES_PER_PREFIX=1`) to keep review propagation inside that limit. If approaching the timeout, reduce `originals/` size (e.g., generate webp originals via sharp instead of copying raw PNG — see SPEC §5.1 future tweaks).
- **PWA Service Worker cache**: precache only ~420 KB. Pages and images are cached at runtime (NetworkFirst / StaleWhileRevalidate) so the iOS ~50 MB SW limit is never hit.
- **Pagefind search**: build script runs `pagefind --site dist --bundle-dir pagefind` to generate a site-wide search index. The Docs page wiring of Pagefind UI is a future task (see SPEC).
