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
			// Resolve post hero image or site fallback for RSS feed reader previews
			const imageUrl = post.data.heroImage
				? new URL(post.data.heroImage.src, context.site).toString()
				: new URL('/favicon.svg', context.site).toString();

			return {
				title: post.data.title,
				pubDate: post.data.pubDate,
				description: post.data.description,
				link: `/blog/${post.id}/`,
				// Combine category and tags into standard RSS category tags
				categories: [post.data.category, ...(post.data.tags || [])],
				customData: `
					<enclosure url="${imageUrl}" type="image/svg+xml" length="0" />
				`,
			};
		}),
		// Channel-level metadata for feed aggregators (Feedly, Inoreader, NetNewsWire)
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