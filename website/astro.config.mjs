import { defineConfig } from 'astro/config';
import mermaid from 'astro-mermaid';
import starlight from '@astrojs/starlight';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

export default defineConfig({
  site: 'https://abrisene.github.io/acausal',
  base: '/acausal',
  integrations: [
    mermaid({ theme: 'dark', autoTheme: true }),
    starlight({
      title: 'acausal',
      tagline:
        'Weighted random distributions, Markov chains, and seeded PRNG for TypeScript',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/abrisene/acausal',
        },
      ],
      editLink: {
        baseUrl:
          'https://github.com/abrisene/acausal/edit/master/website/',
      },
      customCss: ['./src/styles/custom.css'],
      head: [
        {
          tag: 'script',
          attrs: { type: 'module' },
          content: `
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
            mermaid.initialize({ startOnLoad: false, theme: 'dark' });
            await mermaid.run({ nodes: document.querySelectorAll('pre.mermaid') });
            document.addEventListener('astro:after-swap', async () => {
              await mermaid.run({ nodes: document.querySelectorAll('pre.mermaid') });
            });
          `,
        },
      ],
      plugins: [
        starlightTypeDoc({
          entryPoints: ['../src/index.ts'],
          tsconfig: '../tsconfig.json',
          output: 'api',
          sidebar: {
            label: 'API Reference',
            collapsed: true,
          },
          typeDoc: {
            exclude: ['**/*+(index|.test|.spec|.e2e).ts'],
            excludePrivate: true,
            excludeProtected: true,
          },
        }),
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { slug: 'getting-started/introduction' },
            { slug: 'getting-started/installation' },
            { slug: 'getting-started/quick-start' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { slug: 'guides/distributions' },
            { slug: 'guides/random-sampler' },
            { slug: 'guides/markov-chains' },
            { slug: 'guides/chain-analysis' },
            { slug: 'guides/immutable-patterns' },
          ],
        },
        typeDocSidebarGroup,
      ],
    }),
  ],
});
