import { useEffect, useMemo, useState } from 'react';
import PinButton, { readPins } from './PinButton';

type Doc = {
  path: string;
  filename: string;
  category: string;
  lastModified: string;
};

type Props = {
  branchSlug: string;
  docs: Doc[];
};

type SortKey = 'tree' | 'updated' | 'name';

type Node = {
  name: string;
  fullPath: string;
  children: Map<string, Node>;
  doc?: Doc;
};

function buildTree(docs: Doc[]): Node {
  const root: Node = { name: '', fullPath: '', children: new Map() };
  for (const d of docs) {
    const parts = d.path.split('/');
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!cursor.children.has(seg)) {
        cursor.children.set(seg, {
          name: seg,
          fullPath: parts.slice(0, i + 1).join('/'),
          children: new Map(),
        });
      }
      cursor = cursor.children.get(seg)!;
    }
    const leaf: Node = {
      name: parts[parts.length - 1],
      fullPath: d.path,
      children: new Map(),
      doc: d,
    };
    cursor.children.set(leaf.name, leaf);
  }
  return root;
}

function TreeNodeView({
  node,
  branchSlug,
  depth,
}: {
  node: Node;
  branchSlug: string;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const children = Array.from(node.children.values()).sort((a, b) => {
    const ad = a.children.size > 0 ? 0 : 1;
    const bd = b.children.size > 0 ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return a.name.localeCompare(b.name);
  });
  return (
    <ul className="pl-3 border-l border-border">
      {children.map((c) => {
        const isDir = !c.doc;
        if (isDir) {
          return (
            <li key={c.fullPath} className="my-0.5">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1 text-fg-subtle hover:text-fg text-sm"
              >
                <span className="inline-block w-3 text-center">{open ? '▾' : '▸'}</span>
                <span className="font-mono">{c.name}/</span>
              </button>
              {open && (
                <TreeNodeView node={c} branchSlug={branchSlug} depth={depth + 1} />
              )}
            </li>
          );
        }
        const docSlug = c.fullPath.replace(/\.md$/, '');
        return (
          <li key={c.fullPath} className="my-0.5 flex items-center gap-2">
            <a
              href={`/${branchSlug}/docs/${docSlug}`}
              className="font-mono text-sm text-fg no-underline hover:text-accent flex-1 truncate"
            >
              {c.name}
            </a>
            <PinButton branchSlug={branchSlug} itemKey={c.fullPath} kind="doc" size="sm" />
          </li>
        );
      })}
    </ul>
  );
}

export default function DocsTree({ branchSlug, docs }: Props) {
  const [sort, setSort] = useState<SortKey>('tree');
  const [pinVersion, setPinVersion] = useState(0);

  useEffect(() => {
    function onPin() {
      setPinVersion((v) => v + 1);
    }
    window.addEventListener('viewer:pin-change', onPin as EventListener);
    return () => window.removeEventListener('viewer:pin-change', onPin as EventListener);
  }, []);

  const pinned = useMemo(() => {
    const set = new Set(readPins(branchSlug, 'doc'));
    return docs.filter((d) => set.has(d.path));
  }, [branchSlug, docs, pinVersion]);

  const tree = useMemo(() => buildTree(docs), [docs]);

  const flat = useMemo(() => {
    const arr = docs.slice();
    if (sort === 'name') arr.sort((a, b) => a.filename.localeCompare(b.filename));
    else if (sort === 'updated')
      arr.sort((a, b) => (a.lastModified < b.lastModified ? 1 : -1));
    return arr;
  }, [docs, sort]);

  return (
    <div className="px-3 pt-2 pb-20">
      {pinned.length > 0 && (
        <section className="mb-4">
          <h2 className="text-xs uppercase tracking-wider text-fg-subtle mb-1">Pinned</h2>
          <ul className="space-y-1">
            {pinned.map((d) => {
              const docSlug = d.path.replace(/\.md$/, '');
              return (
                <li key={d.path} className="flex items-center gap-2">
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

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-fg-subtle">Sort:</span>
        {(['tree', 'updated', 'name'] as SortKey[]).map((s) => (
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
      </div>

      {sort === 'tree' ? (
        <TreeNodeView node={tree} branchSlug={branchSlug} depth={0} />
      ) : (
        <ul className="space-y-1">
          {flat.map((d) => {
            const docSlug = d.path.replace(/\.md$/, '');
            return (
              <li key={d.path} className="flex items-center gap-2">
                <a
                  href={`/${branchSlug}/docs/${docSlug}`}
                  className="font-mono text-sm text-fg no-underline hover:text-accent flex-1 truncate"
                >
                  {d.path}
                </a>
                <PinButton branchSlug={branchSlug} docPath={d.path} size="sm" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
