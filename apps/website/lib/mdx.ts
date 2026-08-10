import fs from 'fs';
import path from 'path';

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
  const frontmatterRegex = /---\s*([\s\S]*?)\s*---/;
  const match = frontmatterRegex.exec(fileContent);
  const frontmatter: Record<string, any> = {};
  let content = fileContent;

  if (match) {
    const rawFrontmatter = match[1];
    content = fileContent.replace(frontmatterRegex, '').trim();

    rawFrontmatter.split('\n').forEach((line) => {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.slice(0, colonIndex).trim();
        let value: any = line.slice(colonIndex + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        frontmatter[key] = value;
      }
    });
  }

  return { frontmatter, content };
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
      const { frontmatter, content } = parseFrontmatter(fileContent);

      return {
        slug,
        title: frontmatter.title || 'Untitled Post',
        description: frontmatter.description || '',
        date: frontmatter.date || new Date().toISOString().split('T')[0],
        author: frontmatter.author || 'Dineiz Team',
        authorRole: frontmatter.authorRole || 'POS Specialist',
        category: frontmatter.category || 'Guide',
        readTime: frontmatter.readTime || '5 min read',
        image: frontmatter.image || '/images/blog-placeholder.jpg',
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
  const { frontmatter, content } = parseFrontmatter(fileContent);

  return {
    slug,
    title: frontmatter.title || 'Untitled Post',
    description: frontmatter.description || '',
    date: frontmatter.date || new Date().toISOString().split('T')[0],
    author: frontmatter.author || 'Dineiz Team',
    authorRole: frontmatter.authorRole || 'POS Specialist',
    category: frontmatter.category || 'Guide',
    readTime: frontmatter.readTime || '5 min read',
    image: frontmatter.image || '/images/blog-placeholder.jpg',
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
          { metric: frontmatter.metric1 || '+35%', label: frontmatter.label1 || 'Revenue Growth' },
          { metric: frontmatter.metric2 || '15 min', label: frontmatter.label2 || 'Daily Reconciliation' },
          { metric: frontmatter.metric3 || '0', label: frontmatter.label3 || 'Cash Discrepancies' },
        ],
        quote: frontmatter.quote || '',
        author: frontmatter.author || 'Owner',
        image: frontmatter.image || '/images/case-study-placeholder.jpg',
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
      { metric: frontmatter.metric1 || '+35%', label: frontmatter.label1 || 'Revenue Growth' },
      { metric: frontmatter.metric2 || '15 min', label: frontmatter.label2 || 'Daily Reconciliation' },
      { metric: frontmatter.metric3 || '0', label: frontmatter.label3 || 'Cash Discrepancies' },
    ],
    quote: frontmatter.quote || '',
    author: frontmatter.author || 'Owner',
    image: frontmatter.image || '/images/case-study-placeholder.jpg',
    content,
  };
}
