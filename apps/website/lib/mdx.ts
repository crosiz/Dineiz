import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  authorRole?: string;
  category: string;
  readTime: string;
  image?: string;
  content: string;
}

export interface CaseStudy {
  slug: string;
  restaurantName: string;
  restaurantType: string;
  location: string;
  challenge: string;
  solution: string;
  results: { metric: string; label: string }[];
  quote: string;
  author: string;
  image?: string;
  content: string;
}

const contentDir = path.join(process.cwd(), 'content');

function parseFrontmatter(fileContent: string) {
  const { data, content } = matter(fileContent);
  const stats = readingTime(content);
  return { frontmatter: data, content, readTime: stats.text };
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const blogDir = path.join(contentDir, 'blog');
  if (!fs.existsSync(blogDir)) return [];

  const files = fs.readdirSync(blogDir);
  const posts = files
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const slug = file.replace(/\.mdx$/, '');
      const filePath = path.join(blogDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { frontmatter, content, readTime } = parseFrontmatter(fileContent);

      return {
        slug,
        title: frontmatter.title || 'Untitled Post',
        description: frontmatter.description || '',
        date: frontmatter.date || new Date().toISOString().split('T')[0],
        author: frontmatter.author || 'Dineiz Team',
        authorRole: frontmatter.authorRole || 'POS Specialist',
        category: frontmatter.category || 'Guide',
        readTime: frontmatter.readTime || readTime,
        image: frontmatter.image || `/api/og?title=${encodeURIComponent(frontmatter.title || 'Dineiz Blog')}`,
        content,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return posts;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const blogDir = path.join(contentDir, 'blog');
  const filePath = path.join(blogDir, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, content, readTime } = parseFrontmatter(fileContent);

  return {
    slug,
    title: frontmatter.title || 'Untitled Post',
    description: frontmatter.description || '',
    date: frontmatter.date || new Date().toISOString().split('T')[0],
    author: frontmatter.author || 'Dineiz Team',
    authorRole: frontmatter.authorRole || 'POS Specialist',
    category: frontmatter.category || 'Guide',
    readTime: frontmatter.readTime || readTime,
    image: frontmatter.image || `/api/og?title=${encodeURIComponent(frontmatter.title || 'Dineiz Blog')}`,
    content,
  };
}

export async function getAllCaseStudies(): Promise<CaseStudy[]> {
  const caseDir = path.join(contentDir, 'case-studies');
  if (!fs.existsSync(caseDir)) return [];

  const files = fs.readdirSync(caseDir);
  const studies = files
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const slug = file.replace(/\.mdx$/, '');
      const filePath = path.join(caseDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { frontmatter, content } = parseFrontmatter(fileContent);

      return {
        slug,
        restaurantName: frontmatter.restaurantName || 'Restaurant Case Study',
        restaurantType: frontmatter.restaurantType || 'Food Cart',
        location: frontmatter.location || 'Karachi',
        challenge: frontmatter.challenge || '',
        solution: frontmatter.solution || '',
        results: [
          { metric: frontmatter.metric1 || '—', label: frontmatter.label1 || 'Key Result' },
          { metric: frontmatter.metric2 || '—', label: frontmatter.label2 || 'Key Result' },
          { metric: frontmatter.metric3 || '—', label: frontmatter.label3 || 'Key Result' },
        ],
        quote: frontmatter.quote || '',
        author: frontmatter.author || 'Owner',
        image: frontmatter.image || `/api/og?title=${encodeURIComponent(frontmatter.restaurantName || 'Dineiz Case Study')}`,
        content,
      };
    });

  return studies;
}

export async function getCaseStudyBySlug(slug: string): Promise<CaseStudy | null> {
  const caseDir = path.join(contentDir, 'case-studies');
  const filePath = path.join(caseDir, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, content } = parseFrontmatter(fileContent);

  return {
    slug,
    restaurantName: frontmatter.restaurantName || 'Restaurant Case Study',
    restaurantType: frontmatter.restaurantType || 'Food Cart',
    location: frontmatter.location || 'Karachi',
    challenge: frontmatter.challenge || '',
    solution: frontmatter.solution || '',
    results: [
      { metric: frontmatter.metric1 || '—', label: frontmatter.label1 || 'Key Result' },
      { metric: frontmatter.metric2 || '—', label: frontmatter.label2 || 'Key Result' },
      { metric: frontmatter.metric3 || '—', label: frontmatter.label3 || 'Key Result' },
    ],
    quote: frontmatter.quote || '',
    author: frontmatter.author || 'Owner',
    image: frontmatter.image || `/api/og?title=${encodeURIComponent(frontmatter.restaurantName || 'Dineiz Case Study')}`,
    content,
  };
}

export async function getCategories(): Promise<string[]> {
  const posts = await getAllBlogPosts();
  const categories = new Set(posts.map((post) => post.category));
  return Array.from(categories).sort();
}

export async function getRelatedPosts(currentSlug: string, category: string, limit = 3): Promise<BlogPost[]> {
  const posts = await getAllBlogPosts();
  return posts
    .filter((post) => post.category === category && post.slug !== currentSlug)
    .slice(0, limit);
}
