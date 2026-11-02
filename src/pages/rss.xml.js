import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	const posts = (await getCollection('blog')).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
	);

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => {
			// Option A: Use post heroImage if present, fallback to site favicon SVG
			const imageUrl = post.data.heroImage
				? new URL(post.data.heroImage.src, context.site).toString()
				: new URL('/favicon.svg', context.site).toString();

			const imageType = post.data.heroImage ? 'image/jpeg' : 'image/svg+xml';

			return {
				title: post.data.title,
				pubDate: post.data.pubDate,
				description: post.data.description,
				link: `/blog/${post.id}/`,
				categories: [post.data.category, ...(post.data.tags || [])],
				customData: `
					<enclosure url="${imageUrl}" type="${imageType}" length="0" />
				`,
			};
		}),
		customData: `
					<language>en-us</language>
    				<image>
					<url>${new URL('/favicon.svg', context.site)}</url>
					<title>${SITE_TITLE}</title>
					<link>${context.site}</link>
    				</image>
		`,
	});
}