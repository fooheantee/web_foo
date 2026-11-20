import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE } from "../consts";

export async function GET(context) {
  const posts = (await getCollection("blog", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: posts.map((post) => {
      const heroSrc = post.data.heroImage?.src;
      const imageUrl = heroSrc
        ? new URL(heroSrc, context.site).toString()
        : new URL("/os-seal.png", context.site).toString();

      const imageType = heroSrc?.endsWith(".webp") ? "image/webp" : "image/png";

      return {
        title: post.data.title,
        pubDate: post.data.pubDate,
        description: post.data.description,
        link: `/blog/${post.id}/`,
        categories: post.data.tags || [],
        customData: `<enclosure url="${imageUrl}" type="${imageType}" length="0" />`,
      };
    }),
    customData: `
      <language>en-us</language>
      <image>
        <url>${new URL("/os-seal.png", context.site)}</url>
        <title>${SITE_TITLE}</title>
        <link>${context.site}</link>
      </image>
    `,
  });
}
