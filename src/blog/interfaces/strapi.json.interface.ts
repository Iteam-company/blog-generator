export interface StrapiImageFormat {
  ext: string;
  url: string;
  hash: string;
  mime: string;
  name: string;
  size: number;
  width: number;
  height: number;
}

export interface StrapiImageFormats {
  large?: StrapiImageFormat;
  medium?: StrapiImageFormat;
  small?: StrapiImageFormat;
  thumbnail?: StrapiImageFormat;
}

export interface StrapiImage {
  id?: number;
  ext: string;
  url: string;
  hash: string;
  mime: string;
  name: string;
  size: number;
  width: number;
  height: number;
  formats: StrapiImageFormats;
  provider: string;
  createdAt: string;
  updatedAt: string;
  alternativeText: string | null;
  caption?: string | null;
  previewUrl?: string | null;
  provider_metadata?: any | null;
}

export interface StrapiTextNode {
  type: "text";
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}

export interface StrapiLinkNode {
  type: "link";
  url: string;
  children: StrapiTextNode[];
}

export interface StrapiListItemNode {
  type: "list-item";
  children: Array<StrapiTextNode | StrapiLinkNode>;
}

export interface StrapiHeadingBlock {
  type: "heading";
  level: number;
  children: Array<StrapiTextNode | StrapiLinkNode>;
}

export interface StrapiImageBlock {
  type: "image";
  image: StrapiImage;
  children: StrapiTextNode[];
}

export interface StrapiParagraphBlock {
  type: "paragraph";
  children: Array<StrapiTextNode | StrapiLinkNode>;
}

export interface StrapiListBlock {
  type: "list";
  format: "ordered" | "unordered";
  children: StrapiListItemNode[];
}

export interface StrapiCodeBlock {
  type: "code";
  children: StrapiTextNode[];
}

export interface StrapiQuoteBlock {
  type: "quote";
  children: Array<StrapiTextNode | StrapiLinkNode>;
}

export type StrapiBlock =
  | StrapiHeadingBlock
  | StrapiImageBlock
  | StrapiParagraphBlock
  | StrapiListBlock
  | StrapiCodeBlock
  | StrapiQuoteBlock;

export interface MarkdownMetadata {
  title: string;
  category: string;
  previewDescription: string;
}

export interface StrapiArticleData {
  title: string;
  category: string;
  previewDescription: string;
  previewImage?: number;
  Article: StrapiBlock[];
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface StrapiMeta {
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
}

export interface StrapiArticleResponce {
  data: {
    id?: number;
    attributes: StrapiArticleData;
  };
  meta?: StrapiMeta;
}

export interface StrapiArticleRequest {
  data: StrapiArticleData;
}
