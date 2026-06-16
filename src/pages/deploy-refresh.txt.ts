import branchesData from '@/data/branches.json';

export const prerender = true;

type BranchSummary = {
  name: string;
  slug: string;
  lastCommit?: {
    sha?: string;
    date?: string;
    message?: string;
  };
  albums?: {
    path: string;
    imageCount?: number;
    lastModified?: string;
  }[];
};

function laterDate(a?: string | null, b?: string | null): string {
  if (!a) return b ?? '';
  if (!b) return a;
  return a > b ? a : b;
}

function latestBranch(branches: BranchSummary[]): BranchSummary | null {
  return branches.reduce<BranchSummary | null>((latest, branch) => {
    if (!latest) return branch;
    return laterDate(latest.lastCommit?.date, branch.lastCommit?.date) === branch.lastCommit?.date
      ? branch
      : latest;
  }, null);
}

function latestReview(branches: BranchSummary[]) {
  const reviews = branches.flatMap((branch) =>
    (branch.albums ?? [])
      .filter((album) => album.path.startsWith('docs/review/'))
      .map((album) => ({ branch, album }))
  );

  return reviews.reduce<(typeof reviews)[number] | null>((latest, review) => {
    if (!latest) return review;
    return laterDate(latest.album.lastModified, review.album.lastModified) === review.album.lastModified
      ? review
      : latest;
  }, null);
}

export function GET() {
  const branches = (branchesData.branches ?? []) as BranchSummary[];
  const newestBranch = latestBranch(branches);
  const newestReview = latestReview(branches);
  const generatedAt = branchesData.generatedAt ?? new Date().toISOString();

  const lines = [
    `${generatedAt} viewer content build`,
    newestBranch
      ? `latestBranch=${newestBranch.name} slug=${newestBranch.slug} sha=${newestBranch.lastCommit?.sha ?? 'unknown'} date=${newestBranch.lastCommit?.date ?? 'unknown'} message=${newestBranch.lastCommit?.message ?? ''}`
      : 'latestBranch=none',
    newestReview
      ? `latestReview=${newestReview.branch.slug}/${newestReview.album.path} images=${newestReview.album.imageCount ?? 0} lastModified=${newestReview.album.lastModified ?? 'unknown'}`
      : 'latestReview=none',
  ];

  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
