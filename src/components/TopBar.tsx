import BranchDropdown from './BranchDropdown';
import ThemeToggle from './ThemeToggle';

type BranchSummary = { name: string; slug: string };

type Props = {
  branches: BranchSummary[];
  currentSlug: string;
  baseTab: 'gallery' | 'docs';
  homeHref?: string;
};

export default function TopBar({ branches, currentSlug, baseTab, homeHref = '/' }: Props) {
  return (
    <header className="safe-top sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-border">
      <div className="h-12 px-2 flex items-center justify-between gap-2">
        <a
          href={homeHref}
          aria-label="Home"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-bg-subtle text-fg no-underline"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </a>
        <BranchDropdown branches={branches} currentSlug={currentSlug} baseTab={baseTab} />
        <ThemeToggle />
      </div>
    </header>
  );
}
