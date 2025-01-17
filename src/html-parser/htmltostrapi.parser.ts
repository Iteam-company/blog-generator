import { JSDOM } from "jsdom";
import type {
  StrapiArticleRequest,
  StrapiBlock,
  StrapiTextNode,
  StrapiLinkNode,
  StrapiContentNode,
  StrapiImage,
  StrapiListItemNode,
} from "./interfaces/strapi.json.interface";

export class HtmlToStrapiConverter {
  private dom: JSDOM;

  constructor(html: string) {
    this.dom = new JSDOM(html);
  }

  public convert(): StrapiBlock[] {
    const body = this.dom.window.document.body;
    return this.processChildNodes(body);
  }

  public createArticle(
    html: string,
    metadata: {
      title: string;
      category: string;
      previewDescription: string;
      previewImage?: number;
    }
  ): StrapiArticleRequest {
    const blocks = this.convert();
    return {
      data: {
        ...metadata,
        Article: blocks,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
      },
    };
  }

  private processChildNodes(parent: Node): StrapiBlock[] {
    const blocks: StrapiBlock[] = [];

    for (const node of Array.from(parent.childNodes)) {
      const block = this.processNode(node);
      if (block) {
        blocks.push(block);
      }
    }

    return blocks;
  }

  private processNode(node: Node): StrapiBlock | null {
    if (node.nodeType === node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        return {
          type: "paragraph",
          children: [{ type: "text", text }],
        };
      }
      return null;
    }

    if (node.nodeType === node.ELEMENT_NODE) {
      const element = node as Element;

      switch (element.tagName.toLowerCase()) {
        case "p":
          return {
            type: "paragraph",
            children: this.processTextContent(element),
          };

        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
          return {
            type: "heading",
            level: parseInt(element.tagName[1]),
            children: this.processTextContent(element),
          };

        case "ul":
          return {
            type: "list",
            format: "unordered",
            children: this.processListItems(element),
          };

        case "ol":
          return {
            type: "list",
            format: "ordered",
            children: this.processListItems(element),
          };

        case "pre":
          return {
            type: "code",
            children: [
              {
                type: "text",
                text: element.textContent || "",
              },
            ],
          };

        case "blockquote":
          return {
            type: "quote",
            children: this.processTextContent(element),
          };

        case "img":
          return this.processImage(element);

        // Process other elements as paragraphs
        default:
          const textContent = this.processTextContent(element);
          if (textContent.length > 0) {
            return {
              type: "paragraph",
              children: textContent,
            };
          }
      }
    }

    return null;
  }

  private processListItems(element: Element): StrapiListItemNode[] {
    return Array.from(element.children).map((li) => ({
      type: "list-item",
      children: this.processTextContent(li),
    }));
  }

  private processImage(element: Element): StrapiBlock {
    const imageData: StrapiImage = {
      url: element.getAttribute("src") || "",
      ext: this.getImageExtension(element.getAttribute("src") || ""),
      hash: this.generateHash(),
      mime: this.getMimeType(element.getAttribute("src") || ""),
      name: this.getImageName(element.getAttribute("src") || ""),
      width: parseInt(element.getAttribute("width") || "0"),
      height: parseInt(element.getAttribute("height") || "0"),
      size: 0, // This would need to be calculated from actual image
      formats: {}, // This would need to be generated from actual image
      provider: "local",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      alternativeText: element.getAttribute("alt") || null,
    };

    return {
      type: "image",
      image: imageData,
      children: [
        {
          text: "",
          type: "text",
        },
      ],
    };
  }

  private processTextContent(element: Element): StrapiContentNode[] {
    const nodes: StrapiContentNode[] = [];

    const processNode = (node: Node) => {
      if (node.nodeType === node.TEXT_NODE && node.textContent?.trim()) {
        nodes.push({
          type: "text",
          text: node.textContent,
        });
      } else if (node.nodeType === node.ELEMENT_NODE) {
        const el = node as Element;
        const textContent = el.textContent?.trim() || "";
        if (!textContent) return;

        switch (el.tagName.toLowerCase()) {
          case "strong":
          case "b":
            nodes.push({
              type: "text",
              text: textContent,
              bold: true,
            });
            break;

          case "em":
          case "i":
            nodes.push({
              type: "text",
              text: textContent,
              italic: true,
            });
            break;

          case "code":
            nodes.push({
              type: "text",
              text: textContent,
              code: true,
            });
            break;

          case "strike":
          case "s":
            nodes.push({
              type: "text",
              text: textContent,
              strikethrough: true,
            });
            break;

          case "u":
            nodes.push({
              type: "text",
              text: textContent,
              underline: true,
            });
            break;

          case "a":
            const href = (el as HTMLAnchorElement).href;
            const linkNode: StrapiLinkNode = {
              type: "link",
              url: href,
              children: [
                {
                  type: "text",
                  text: textContent,
                },
              ],
            };
            nodes.push(linkNode);
            break;

          // Process nested elements
          default:
            Array.from(el.childNodes).forEach(processNode);
        }
      }
    };

    Array.from(element.childNodes).forEach(processNode);
    return nodes;
  }

  private getImageExtension(url: string): string {
    const match = url.match(/\.([^.]+)$/);
    return match ? `.${match[1].toLowerCase()}` : "";
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

  private generateHash(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
