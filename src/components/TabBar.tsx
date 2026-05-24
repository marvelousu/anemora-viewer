type Props = {
  branchSlug: string;
  current: 'gallery' | 'docs';
};

export default function TabBar({ branchSlug, current }: Props) {
  const tabs: Array<{ key: 'gallery' | 'docs'; label: string; icon: JSX.Element }> = [
    {
      key: 'gallery',
      label: 'Gallery',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      ),
    },
    {
      key: 'docs',
      label: 'Docs',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="13" y2="17" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 safe-bottom bg-bg/95 backdrop-blur border-t border-border z-20">
      <ul className="flex items-stretch">
        {tabs.map((t) => (
          <li key={t.key} className="flex-1">
            <a
              href={`/${branchSlug}/${t.key}`}
              className={`flex flex-col items-center justify-center gap-1 py-2 text-xs no-underline ${
                current === t.key ? 'text-accent' : 'text-fg-subtle'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
