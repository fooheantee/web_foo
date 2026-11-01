import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string().min(80).max(160),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z.array(z.string()).default([]),
			keywords: z.array(z.string()).default([]),
			draft: z.boolean().optional().default(false),
			// Category maps directly to SVG icon options
			category: z.enum(['identity', 'homelab', 'security', 'dev', 'architecture']).default('security'),
		}),
});

export const collections = { blog };