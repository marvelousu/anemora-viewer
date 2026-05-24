import { useEffect, useRef, useState } from 'react';

type BranchSummary = {
  name: string;
  slug: string;
};

type Props = {
  branches: BranchSummary[];
  currentSlug: string;
  baseTab: 'gallery' | 'docs';
};

export default function BranchDropdown({ branches, currentSlug, baseTab }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = branches.find((b) => b.slug === currentSlug);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 rounded-full bg-bg-subtle text-xs font-mono truncate max-w-[60vw] flex items-center gap-1"
      >
        <span className="truncate">{current?.name ?? currentSlug}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-bg border border-border rounded-xl shadow-lg overflow-hidden z-30 min-w-[80vw] max-w-[92vw]">
          <ul>
            {branches.map((b) => (
              <li key={b.slug}>
                <a
                  href={`/${b.slug}/${baseTab}`}
                  className={`block px-4 py-3 text-xs font-mono no-underline border-b border-border last:border-b-0 ${
                    b.slug === currentSlug ? 'bg-bg-subtle font-semibold' : ''
                  }`}
                >
                  {b.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
