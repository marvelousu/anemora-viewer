import { useEffect, useState } from 'react';

export type PinKind = 'doc' | 'album';

type Props = {
  branchSlug: string;
  itemKey: string;
  kind: PinKind;
  size?: 'sm' | 'md';
  /**
   * Legacy alias for itemKey used by the original Docs page wiring.
   * Kept so we don't have to touch existing call sites that pass `docPath`.
   */
  docPath?: string;
};

export function pinStorageKey(branchSlug: string, kind: PinKind): string {
  return kind === 'album' ? `viewer.gallery-pin.${branchSlug}` : `viewer.pin.${branchSlug}`;
}

export function readPins(branchSlug: string, kind: PinKind): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(pinStorageKey(branchSlug, kind));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writePins(branchSlug: string, kind: PinKind, pins: string[]) {
  localStorage.setItem(pinStorageKey(branchSlug, kind), JSON.stringify(pins));
}

export default function PinButton({ branchSlug, itemKey, docPath, kind, size = 'md' }: Props) {
  const key = itemKey ?? docPath ?? '';
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(readPins(branchSlug, kind).includes(key));
  }, [branchSlug, key, kind]);

  function toggle(e: React.MouseEvent) {
    // Prevent triggering parent <a> when nested inside album cards
    e.preventDefault();
    e.stopPropagation();
    const current = readPins(branchSlug, kind);
    const next = pinned ? current.filter((p) => p !== key) : [...current, key];
    writePins(branchSlug, kind, next);
    setPinned(!pinned);
    window.dispatchEvent(
      new CustomEvent('viewer:pin-change', { detail: { branchSlug, kind } })
    );
  }

  const dim = size === 'sm' ? 16 : 22;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={pinned ? 'Unpin' : 'Pin'}
      className="inline-flex items-center justify-center text-fg-subtle hover:text-accent"
    >
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill={pinned ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: pinned ? 'rgb(var(--accent))' : undefined }}
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
