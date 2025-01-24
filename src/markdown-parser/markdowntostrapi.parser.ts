import { marked } from "marked";
import { type Token } from "marked";
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
  private content: string;

  constructor(markdown: string, meta?: MarkdownMetadata) {
    if (!meta) {
      const { metadata, content } = this.parseFrontmatter(markdown);
      this.metadata = metadata;
      this.content = content;
      this.tokens = marked.lexer(content);
    } else {
      this.metadata = meta;
      this.content = markdown;
      this.tokens = marked.lexer(markdown);
    }
  }

  getData(): { metadata: MarkdownMetadata; content: string } {
    return { metadata: this.metadata!, content: this.content };
  }

  private parseFrontmatter(markdown: string): {
    metadata: MarkdownMetadata;
    content: string;
  } {
    const titleRegex = /title:\s*(.*?)\n/;
    const categoryRegex = /category:\s*(.*?)\n/;
    const previewRegex = /previewDescription:\s*(.*?)\n/;
    const contentRegex = /^---\n[\s\S]*?\n---\n([\s\S]*)$/;

    return {
      metadata: {
        title: markdown.match(titleRegex)?.[1] || "",
        category: markdown.match(categoryRegex)?.[1] || "",
        previewDescription: markdown.match(previewRegex)?.[1] || "",
      },
      content: markdown.match(contentRegex)?.[1] || "",
    };
  }

  public convert(): StrapiArticleRequest {
    if (!this.metadata) {
      throw new Error("No metadata found");
    }

    return {
      data: {
        title: this.metadata.title,
        category: this.metadata.category,
        previewDescription: this.metadata.previewDescription,
        Article: this.processTokens(this.tokens),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
      },
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
      case "heading":
        return {
          type: "heading",
          level: token.depth,
          children: this.processInlineText(token.text),
        };

      case "paragraph": {
        // Check if the paragraph contains only an image
        const imageMatch = token.text.match(/^!\[(.*?)\]\((.*?)\)$/);
        if (imageMatch) {
          const [, alt, url] = imageMatch;
          return {
            type: "image",
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
              provider: "local",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              alternativeText: alt || null,
            },
            children: [{ type: "text", text: "" }],
          };
        }
        return {
          type: "paragraph",
          children: this.processInlineText(token.text),
        };
      }

      case "list":
        return {
          type: "list",
          format: token.ordered ? "ordered" : "unordered",
          children: token.items.map((item: any) => ({
            type: "list-item",
            children: this.processInlineText(item.text),
          })),
        };

      case "code":
        return {
          type: "code",
          children: [
            {
              type: "text",
              text: token.text,
            },
          ],
        };

      case "blockquote":
        return {
          type: "quote",
          children: this.processInlineText(token.text),
        };

      default:
        return null;
    }
  }

  private processInlineText(
    text: string
  ): Array<StrapiTextNode | StrapiLinkNode> {
    const nodes: Array<StrapiTextNode | StrapiLinkNode> = [];
    let currentText = text;
    const matches: Array<{
      index: number;
      length: number;
      originalText: string;
      processedText: string;
      formats: Array<"bold" | "italic" | "code">;
      type?: "link";
      url?: string;
    }> = [];

    // Process in order: code, bold-italic, bold, italic, links
    const patterns = [
      {
        regex: /`([^`]+)`/g,
        formats: ["code"] as Array<"bold" | "italic" | "code">,
      },
      {
        regex: /(?<![*_])[*_]{3}(.*?)[*_]{3}(?![*_])/g,
        formats: ["bold", "italic"] as Array<"bold" | "italic" | "code">,
      },
      {
        regex: /(?<![*_])[*_]{2}(?![*_])(.*?)(?<![*_])[*_]{2}(?![*_])/g,
        formats: ["bold"] as Array<"bold" | "italic" | "code">,
      },
      {
        regex: /(?<![*_])[*_](?![*_])(.*?)(?<![*_])[*_](?![*_])/g,
        formats: ["italic"] as Array<"bold" | "italic" | "code">,
      },
    ];

    for (const pattern of patterns) {
      let match: any;
      while ((match = pattern.regex.exec(currentText)) !== null) {
        const overlapping = matches.some(
          (m) =>
            (match.index >= m.index && match.index < m.index + m.length) ||
            (m.index >= match.index && m.index < match.index + match[0].length)
        );

        if (!overlapping) {
          matches.push({
            index: match.index,
            length: match[0].length,
            originalText: match[0],
            processedText: match[1],
            formats: pattern.formats,
          });
        }
      }
    }

    // Handle links separately
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match: any;
    while ((match = linkRegex.exec(currentText)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        originalText: match[0],
        processedText: match[1],
        formats: [],
        type: "link",
        url: match[2],
      });
    }

    matches.sort((a, b) => a.index - b.index);

    let lastIndex = 0;
    for (const match of matches) {
      if (match.index > lastIndex) {
        nodes.push({
          type: "text",
          text: currentText.slice(lastIndex, match.index),
        });
      }

      if (match.type === "link") {
        nodes.push({
          type: "link",
          url: match.url!,
          children: [{ type: "text", text: match.processedText }],
        });
      } else {
        const node: any = { type: "text", text: match.processedText };
        match.formats.forEach((format) => (node[format] = true));
        nodes.push(node);
      }

      lastIndex = match.index + match.length;
    }

    if (lastIndex < currentText.length) {
      nodes.push({ type: "text", text: currentText.slice(lastIndex) });
    }

    return nodes;
  }

  private generateHash(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private getImageExtension(url: string): string {
    const match = url.match(/\.([^.]+)$/);
    return match ? `.${match[1].toLowerCase()}` : ".jpg";
  }

  private getMimeType(url: string): string {
    const ext = this.getImageExtension(url);
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
    };
    return mimeTypes[ext] || "image/jpeg";
  }

  private getImageName(url: string): string {
    const parts = url.split("/");
    return parts[parts.length - 1] || "image";
  }
}
