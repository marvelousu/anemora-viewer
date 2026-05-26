import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkGfm from 'remark-gfm';
// @ts-expect-error: remark-wiki-link lacks proper ESM types
import remarkWikiLink from 'remark-wiki-link';

type Processor = Awaited<ReturnType<typeof createMarkdownProcessor>>;

let _processor: Processor | null = null;

async function getProcessor(): Promise<Processor> {
  if (_processor) return _processor;
  _processor = await createMarkdownProcessor({
    syntaxHighlight: 'shiki',
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
    remarkPlugins: [
      remarkGfm,
      [remarkWikiLink, { aliasDivider: '|', hrefTemplate: (slug: string) => `./${slug}` }],
    ],
    rehypePlugins: [],
  });
  return _processor;
}

export async function renderMarkdown(src: string): Promise<string> {
  const processor = await getProcessor();
  const result = await processor.render(src);
  return result.code;
}
