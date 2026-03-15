export interface WeiboPost {
  id: string;
  author: string;
  content: string;
  publishTime: string;
  link?: string;
  isRetweet?: boolean;
}

export interface DoubanBook {
  id: string;
  title: string;
  rating: string;
  readDate: string;
  comment: string;
  link?: string;
}
