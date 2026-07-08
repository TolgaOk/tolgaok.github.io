import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/posts" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.coerce.date(),
      // Groups posts on the landing page and forms the URL: /<kind>/<slug>/
      kind: z.string(),
      // Small thumbnail shown next to the post in the landing list.
      image: image().optional(),
      thumbnail: z.string().optional(),
      theme: z.enum(["device", "light", "dark"]).optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { posts };
