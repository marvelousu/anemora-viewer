import { useEffect, useMemo, useState } from 'react';
import PinButton, { readPins } from './PinButton';

type Album = {
  path: string;
  imageCount: number;
  representativeThumb: string;
  lastModified?: string;
  devlogRef?: string | null;
};

type Doc = {
  path: string;
  filename: string;
};

type Props = {
  branchSlug: string;
  albums: Album[];
  docs: Doc[];
};

export default function PinnedItemsView({ branchSlug, albums, docs }: Props) {
  const [pinVersion, setPinVersion] = useState(0);

  useEffect(() => {
    function onPin() {
      setPinVersion((v) => v + 1);
    }
    window.addEventListener('viewer:pin-change', onPin as EventListener);
    return () => window.removeEventListener('viewer:pin-change', onPin as EventListener);
  }, []);

  const pinnedAlbums = useMemo(() => {
    const set = new Set(readPins(branchSlug, 'album'));
    return albums.filter((a) => set.has(a.path));
  }, [branchSlug, albums, pinVersion]);

  const pinnedDocs = useMemo(() => {
    const set = new Set(readPins(branchSlug, 'doc'));
    return docs.filter((d) => set.has(d.path));
  }, [branchSlug, docs, pinVersion]);

  if (pinnedAlbums.length === 0 && pinnedDocs.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-sm text-fg-subtle">No pinned items in this branch.</p>
        <p className="text-xs text-fg-subtle mt-2">
          Tap the ★ on any album in <b>Gallery</b> or any file in <b>Docs</b> to pin it here.
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 pb-20 max-w-screen-xl mx-auto">
      {pinnedAlbums.length > 0 && (
        <section className="mb-5">
          <h2 className="px-1 text-xs uppercase tracking-wider text-fg-subtle mb-2">
            Albums ({pinnedAlbums.length})
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedAlbums.map((a) => (
              <li key={`a-${a.path}`}>
                <a
                  href={`/${branchSlug}/gallery/${a.path}`}
                  className="flex items-center gap-3 p-2 rounded-xl bg-bg-subtle no-underline text-fg"
                >
                  <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-bg">
                    <img
                      src={a.representativeThumb}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm truncate">{a.path}</div>
                    <div className="text-xs text-fg-subtle mt-1 flex items-center gap-2">
                      <span>{a.imageCount} images</span>
                      {a.devlogRef && (
                        <span className="inline-flex items-center gap-0.5 text-accent">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          devlog
                        </span>
                      )}
                    </div>
                  </div>
                  <PinButton branchSlug={branchSlug} itemKey={a.path} kind="album" size="sm" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pinnedDocs.length > 0 && (
        <section>
          <h2 className="px-1 text-xs uppercase tracking-wider text-fg-subtle mb-2">
            Docs ({pinnedDocs.length})
          </h2>
          <ul className="space-y-1">
            {pinnedDocs.map((d) => {
              const docSlug = d.path.replace(/\.md$/, '');
              return (
                <li key={`d-${d.path}`} className="flex items-center gap-2 p-2 rounded-lg bg-bg-subtle">
                  <a
                    href={`/${branchSlug}/docs/${docSlug}`}
                    className="font-mono text-sm text-fg no-underline hover:text-accent flex-1 truncate"
                  >
                    {d.path}
                  </a>
                  <PinButton branchSlug={branchSlug} itemKey={d.path} kind="doc" size="sm" />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
