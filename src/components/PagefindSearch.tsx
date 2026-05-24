import { useEffect, useRef, useState } from 'react';

type PagefindResult = {
  id: string;
  data: () => Promise<{
    url: string;
    excerpt: string;
    meta?: { title?: string };
  }>;
};

type PagefindModule = {
  search: (q: string) => Promise<{ results: PagefindResult[] }>;
};

type Hit = { id: string; url: string; excerpt: string; title: string };

type Props = {
  branchSlug: string;
};

export default function PagefindSearch({ branchSlug }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagefind, setPagefind] = useState<PagefindModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Pagefind is generated at build time into /pagefind/pagefind.js.
        // @vite-ignore: Vite must not try to resolve this at build time.
        const mod = (await import(/* @vite-ignore */ '/pagefind/pagefind.js')) as PagefindModule;
        if (mounted) setPagefind(mod);
      } catch (err) {
        if (mounted) setError('Search index not available (build with `pagefind` first).');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!pagefind) return;
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const search = await pagefind.search(query);
        const out: Hit[] = [];
        const prefix = `/${branchSlug}/`;
        for (const r of search.results.slice(0, 40)) {
          const data = await r.data();
          if (!data.url.startsWith(prefix)) continue;
          out.push({
            id: r.id,
            url: data.url,
            excerpt: data.excerpt,
            title: data.meta?.title ?? data.url,
          });
          if (out.length >= 20) break;
        }
        if (id === reqId.current) {
          setHits(out);
          setLoading(false);
        }
      } catch {
        if (id === reqId.current) {
          setHits([]);
          setLoading(false);
        }
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query, pagefind, branchSlug]);

  return (
    <div>
      <div className="relative">
        <input
          type="search"
          inputMode="search"
          placeholder="Search this branch..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-bg-subtle border border-border text-sm focus:outline-none focus:border-accent"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">…</div>
        )}
      </div>
      {error && <p className="text-xs text-fg-subtle mt-2">{error}</p>}
      {query && !loading && hits.length === 0 && !error && (
        <p className="text-xs text-fg-subtle mt-2">No matches in this branch.</p>
      )}
      {hits.length > 0 && (
        <ul className="mt-2 space-y-1">
          {hits.map((h) => (
            <li key={h.id}>
              <a
                href={h.url}
                className="block p-2 rounded hover:bg-bg-subtle no-underline border border-border"
              >
                <div className="font-mono text-xs truncate text-fg">{h.url.replace(`/${branchSlug}/`, '')}</div>
                <div
                  className="text-xs text-fg-subtle mt-1 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: h.excerpt }}
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
