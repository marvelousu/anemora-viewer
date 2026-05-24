import { motion } from 'framer-motion';

type Branch = {
  name: string;
  slug: string;
  lastCommit: { sha: string; date: string; message: string };
  touchedRecent7d: number;
  representativeImage: string | null;
};

type Props = {
  branches: Branch[];
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} h ago`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export default function HomeCardList({ branches }: Props) {
  if (branches.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-fg-subtle">
        <p>No active branches.</p>
        <p className="text-xs mt-2">
          Run a build after pushing to a <code>work/*</code> branch on the source repo.
        </p>
      </div>
    );
  }

  return (
    <ul className="px-3 py-2 space-y-3 safe-bottom">
      {branches.map((b, i) => (
        <motion.li
          key={b.slug}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.05 }}
        >
          <a
            href={`/${b.slug}/review`}
            className="block rounded-2xl overflow-hidden border border-border bg-bg-subtle no-underline"
          >
            <div className="aspect-[16/9] bg-bg-subtle relative">
              {b.representativeImage ? (
                <img
                  src={b.representativeImage}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-fg-subtle text-sm">
                  No preview
                </div>
              )}
            </div>
            <div className="px-4 py-3">
              <div className="font-mono text-sm text-fg truncate">{b.name}</div>
              <div className="text-xs text-fg-subtle mt-1 line-clamp-1">{b.lastCommit.message}</div>
              <div className="flex items-center gap-3 text-xs text-fg-subtle mt-2">
                <span>{relativeTime(b.lastCommit.date)}</span>
                <span>+{b.touchedRecent7d} files (7d)</span>
              </div>
            </div>
          </a>
        </motion.li>
      ))}
    </ul>
  );
}
