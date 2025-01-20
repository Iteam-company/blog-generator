import { marked } from "marked";
import { type Token } from "marked";
import YAML from "yaml";
import {
  MarkdownMetadata,
  StrapiArticleRequest,
  StrapiBlock,
  StrapiLinkNode,
  StrapiTextNode,
} from "../blog/interfaces/strapi.json.interface";

export class MarkdownToStrapiConverter {
  private tokens: Token[] = [];
  private metadata: MarkdownMetadata | null = null;

  constructor(markdown: string) {
    const { metadata, content } = this.parseFrontmatter(markdown);
    this.metadata = metadata;
    this.tokens = marked.lexer(content);
  }

  private parseFrontmatter(markdown: string): { metadata: MarkdownMetadata; content: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = markdown.match(frontmatterRegex);

    if (!match) {
      throw new Error('No frontmatter found in markdown');
    }

    const [, frontmatter, content] = match;
    const metadata = YAML.parse(frontmatter) as MarkdownMetadata;

    return { metadata, content };
  }

  public convert(): StrapiArticleRequest {
    if (!this.metadata) {
      throw new Error('No metadata found');
    }

    return {
      data: {
        title: this.metadata.title,
        category: this.metadata.category,
        previewDescription: this.metadata.previewDescription,
        Article: this.processTokens(this.tokens),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString()
      }
    };
  }

  private processTokens(tokens: Token[]): StrapiBlock[] {
    const blocks: StrapiBlock[] = [];

    for (const token of tokens) {
      const block = this.processToken(token);
      if (block) {
        blocks.push(block);
      }
    }

    return blocks;
  }

  private processToken(token: Token): StrapiBlock | null {
    switch (token.type) {
      case 'heading':
        return {
          type: 'heading',
          level: token.depth,
          children: this.processInlineText(token.text)
        };

      case 'paragraph': {
        // Check if the paragraph contains only an image
        const imageMatch = token.text.match(/^!\[(.*?)\]\((.*?)\)$/);
        if (imageMatch) {
          const [, alt, url] = imageMatch;
          return {
            type: 'image',
            image: {
              ext: this.getImageExtension(url),
              url: url,
              hash: this.generateHash(),
              mime: this.getMimeType(url),
              name: this.getImageName(url),
              size: 0,
              width: 0,
              height: 0,
              formats: {},
              provider: 'local',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              alternativeText: alt || null
            },
            children: [{ type: 'text', text: '' }]
          };
        }
        return {
          type: 'paragraph',
          children: this.processInlineText(token.text)
        };
      }

      case 'list':
        return {
          type: 'list',
          format: token.ordered ? 'ordered' : 'unordered',
          children: token.items.map((item: any) => ({
            type: 'list-item',
            children: this.processInlineText(item.text)
          }))
        };

      case 'code':
        return {
          type: 'code',
          children: [{
            type: 'text',
            text: token.text
          }]
        };

      case 'blockquote':
        return {
          type: 'quote',
          children: this.processInlineText(token.text)
        };

      default:
        return null;
    }
  }

  private processInlineText(text: string): Array<StrapiTextNode | StrapiLinkNode> {
    const nodes: Array<StrapiTextNode | StrapiLinkNode> = [];
    let currentText = text;

    // Find all matches
    const matches: Array<{
      index: number;
      length: number;
      originalText: string;
      processedText: string;
      type: 'bold' | 'italic' | 'code' | 'link';
      url?: string;
    }> = [];

    // Find code spans first
    const codeRegex = /`([^`]+)`/g;
    let match: any;
    while ((match = codeRegex.exec(currentText)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        originalText: match[0],
        processedText: match[1],
        type: 'code'
      });
    }

    // Find bold text
    const boldRegex = /\*\*(.*?)\*\*/g;
    while ((match = boldRegex.exec(currentText)) !== null) {
      const overlapping = matches.some(m => 
        (match.index >= m.index && match.index < m.index + m.length) ||
        (m.index >= match.index && m.index < match.index + match[0].length)
      );

      if (!overlapping) {
        matches.push({
          index: match.index,
          length: match[0].length,
          originalText: match[0],
          processedText: match[1],
          type: 'bold'
        });
      }
    }

    // Find italic text
    const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)/g;
    while ((match = italicRegex.exec(currentText)) !== null) {
      const overlapping = matches.some(m => 
        (match.index >= m.index && match.index < m.index + m.length) ||
        (m.index >= match.index && m.index < match.index + match[0].length)
      );

      if (!overlapping) {
        matches.push({
          index: match.index,
          length: match[0].length,
          originalText: match[0],
          processedText: match[1],
          type: 'italic'
        });
      }
    }

    // Find links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((match = linkRegex.exec(currentText)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        originalText: match[0],
        processedText: match[1],
        type: 'link',
        url: match[2]
      });
    }

    // Sort matches by index
    matches.sort((a, b) => a.index - b.index);

    // Process text with matches
    let lastIndex = 0;
    for (const match of matches) {
      // Add text before match
      if (match.index > lastIndex) {
        const textBefore = currentText.slice(lastIndex, match.index);
        nodes.push({ type: 'text', text: textBefore });
      }

      // Add formatted text
      if (match.type === 'link') {
        nodes.push({
          type: 'link',
          url: match.url!,
          children: [{ type: 'text', text: match.processedText }]
        });
      } else {
        nodes.push({
          type: 'text',
          text: match.processedText,
          [match.type]: true
        });
      }

      lastIndex = match.index + match.length;
    }

    // Add remaining text
    if (lastIndex < currentText.length) {
      const remainingText = currentText.slice(lastIndex);
      nodes.push({ type: 'text', text: remainingText });
    }

    return nodes;
  }

  private generateHash(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private getImageExtension(url: string): string {
    const match = url.match(/\.([^.]+)$/);
    return match ? `.${match[1].toLowerCase()}` : '.jpg';
  }

  private getMimeType(url: string): string {
    const ext = this.getImageExtension(url);
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  private getImageName(url: string): string {
    const parts = url.split('/');
    return parts[parts.length - 1] || 'image';
  }
}