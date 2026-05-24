import { useEffect, useState } from 'react';

type Props = {
  branchSlug: string;
  docPath: string;
  size?: 'sm' | 'md';
};

function storageKey(branchSlug: string) {
  return `viewer.pin.${branchSlug}`;
}

function readPins(branchSlug: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(branchSlug));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writePins(branchSlug: string, pins: string[]) {
  localStorage.setItem(storageKey(branchSlug), JSON.stringify(pins));
}

export default function PinButton({ branchSlug, docPath, size = 'md' }: Props) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(readPins(branchSlug).includes(docPath));
  }, [branchSlug, docPath]);

  function toggle() {
    const current = readPins(branchSlug);
    const next = pinned ? current.filter((p) => p !== docPath) : [...current, docPath];
    writePins(branchSlug, next);
    setPinned(!pinned);
    // Broadcast for any listening tree views
    window.dispatchEvent(new CustomEvent('viewer:pin-change', { detail: { branchSlug } }));
  }

  const dim = size === 'sm' ? 16 : 22;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={pinned ? 'Unpin' : 'Pin'}
      className="inline-flex items-center justify-center text-fg-subtle hover:text-accent"
    >
      <svg width={dim} height={dim} viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: pinned ? 'rgb(var(--accent))' : undefined }}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
