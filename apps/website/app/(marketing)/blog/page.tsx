import React from "react";
import { getAllBlogPosts, getCategories } from "@/lib/mdx";
import { generateSEOMetadata } from "@/lib/seo";
import { BlogClient } from "@/components/blog/BlogClient";

export const metadata = generateSEOMetadata({
  title: "Dineiz Blog — Restaurant Management Tips & Guides for Pakistan",
  description:
    "Guides, FBR tax compliance articles, and revenue growth strategies for restaurant owners in Pakistan.",
  path: "/blog",
});

export default async function BlogListingPage() {
  const posts = await getAllBlogPosts();
  const categories = await getCategories();

  return (
    <BlogClient posts={posts} categories={categories} />
  );
}
