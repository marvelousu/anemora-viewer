import { useEffect, useMemo, useState } from 'react';
import PinButton, { readPins } from './PinButton';

type Album = {
  path: string;
  displayLabel?: string;
  imageCount: number;
  representativeThumb: string;
  lastModified: string;
};

type Props = {
  branchSlug: string;
  albums: Album[];
};

type SortKey = 'tree' | 'updated' | 'name';

function relativeTime(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} h ago`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

function AlbumCard({ branchSlug, album, now }: { branchSlug: string; album: Album; now: number | null }) {
  const age = album.lastModified && now ? relativeTime(album.lastModified, now) : '';
  return (
    <a
      href={`/${branchSlug}/gallery/${album.path}`}
      className="flex items-center gap-3 p-2 rounded-xl bg-bg-subtle no-underline text-fg"
    >
      <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-bg">
        <img
          src={album.representativeThumb}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{album.displayLabel ?? album.path}</div>
        {album.displayLabel && (
          <div className="font-mono text-[10px] text-fg-subtle/70 truncate">{album.path}</div>
        )}
        <div className="text-xs text-fg-subtle mt-1">
          {album.imageCount} images{age ? ` · ${age}` : ''}
        </div>
      </div>
      <PinButton branchSlug={branchSlug} itemKey={album.path} kind="album" size="sm" />
    </a>
  );
}

export default function GalleryAlbumList({ branchSlug, albums }: Props) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');
  const [pinVersion, setPinVersion] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    function onPin(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.kind === 'album') setPinVersion((v) => v + 1);
    }
    window.addEventListener('viewer:pin-change', onPin as EventListener);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('viewer:pin-change', onPin as EventListener);
    };
  }, []);

  const pinnedAlbums = useMemo(() => {
    const set = new Set(readPins(branchSlug, 'album'));
    return albums.filter((a) => set.has(a.path));
  }, [branchSlug, albums, pinVersion]);

  const visibleAlbums = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? albums.filter((a) => a.path.toLowerCase().includes(q))
      : albums.slice();
    if (sort === 'updated') {
      filtered.sort((a, b) => (a.lastModified < b.lastModified ? 1 : -1));
    } else if (sort === 'name') {
      filtered.sort((a, b) =>
        a.path.split('/').pop()!.localeCompare(b.path.split('/').pop()!)
      );
    } else {
      filtered.sort((a, b) => a.path.localeCompare(b.path));
    }
    return filtered;
  }, [albums, query, sort]);

  return (
    <div className="px-2 pb-20 max-w-screen-xl mx-auto">
      <div className="px-1 mb-3">
        <input
          type="search"
          inputMode="search"
          placeholder="Filter albums by path..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-bg-subtle border border-border text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {pinnedAlbums.length > 0 && query === '' && (
        <section className="mb-4">
          <h2 className="px-1 text-xs uppercase tracking-wider text-fg-subtle mb-1">Pinned</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {pinnedAlbums.map((a) => (
              <li key={`pin-${a.path}`}>
                <AlbumCard branchSlug={branchSlug} album={a} now={now} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-xs text-fg-subtle">Sort:</span>
        {(['updated', 'tree', 'name'] as SortKey[]).map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setSort(s)}
            className={`px-2 py-0.5 rounded-full text-xs ${
              sort === s ? 'bg-accent text-white' : 'bg-bg-subtle text-fg-subtle'
            }`}
          >
            {s === 'tree' ? 'Tree' : s === 'updated' ? 'Updated' : 'Name'}
          </button>
        ))}
        <span className="ml-auto text-xs text-fg-subtle">{visibleAlbums.length} / {albums.length}</span>
      </div>

      {visibleAlbums.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-fg-subtle">No albums match.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {visibleAlbums.map((a) => (
            <li key={a.path}>
              <AlbumCard branchSlug={branchSlug} album={a} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
