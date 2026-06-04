export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  readingTime: string;
  content: string;
}

export interface TableOfContentsItem {
  id: string;
  text: string;
  level: number;
}
