interface ImageFormat {
  ext: string;
  url: string;
  size: number;
  width: number;
  height: number;
}

interface ImageFormats {
  large: ImageFormat;
  small: ImageFormat;
  medium: ImageFormat;
  thumbnail: ImageFormat;
}

interface Image {
  ext: string;
  url: string;
  hash: string;
  mime: string;
  name: string;
  size: number;
  width: number;
  height: number;
  formats: ImageFormats;
  provider: string;
  createdAt: string;
  updatedAt: string;
  alternativeText: string;
}

interface TextNode {
  text: string;
  type: "text";
}

interface HeadingNode {
  type: "heading";
  level: number;
  children: TextNode[];
}

interface ImageNode {
  type: "image";
  image: Image;
  children: TextNode[];
}

interface ParagraphNode {
  type: "paragraph";
  children: TextNode[];
}

type ArticleNode = HeadingNode | ImageNode | ParagraphNode;

interface ArticleTemplate {
  data: {
    title: string;
    category: string;
    previewDescription: string;
    previewImage: number;
    Article: ArticleNode[];
  };
}

interface InputData {
  title: string;
  category: string;
  previewDescription: string;
  heading: string;
  paragraph: string;
  [key: string]: string; // Allow additional string properties
}

export type {
  InputData,
  ArticleTemplate,
  ArticleNode,
  Image,
  ImageFormat,
  ImageFormats,
  TextNode,
  HeadingNode,
  ImageNode,
  ParagraphNode,
};
