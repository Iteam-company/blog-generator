import { marked } from "marked";
import { type Token } from "marked";
import {
  MarkdownMetadata,
  StrapiArticleRequest,
  StrapiBlock,
  StrapiLinkNode,
  StrapiTextNode,
} from "../blog/interfaces/strapi.json.interface";
import { AxiosInstance } from "axios";
import { rasterizeSvg } from "../utils/utils";

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

  public async convert(
    images: { name: string; data: string }[],
    strapiAxios: AxiosInstance
  ): Promise<StrapiArticleRequest> {
    if (!this.metadata) {
      throw new Error("No metadata found");
    }

    return {
      data: {
        title: this.metadata.title,
        category: this.metadata.category,
        previewDescription: this.metadata.previewDescription,
        Article: await this.processTokens(this.tokens, images, strapiAxios),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
      },
    };
  }

  private async processTokens(
    tokens: Token[],
    images: { name: string; data: string }[],
    strapiAxios: AxiosInstance
  ): Promise<StrapiBlock[]> {
    const blocks: StrapiBlock[] = [];

    for (const token of tokens) {
      const block = await this.processToken(token, images, strapiAxios);
      if (block) {
        blocks.push(block);
      }
    }

    return blocks;
  }

  private async processToken(
    token: Token,
    images: { name: string; data: string }[],
    strapiAxios: AxiosInstance
  ): Promise<StrapiBlock | null> {
    switch (token.type) {
      case "heading":
        return {
          type: "heading",
          level: token.depth,
          children: this.processInlineText(token.text),
        };

      case "paragraph": {
        // Check if the paragraph contains only an image
        const imageMatch = token.text.match(/!\[(.*?)\]\((.*?)\)/);
        try {
          if (imageMatch) {
            const [, alt, url] = imageMatch;
            const res = await this.uploadBase64OrUrlToStrapi(
              images?.find((v) => v.name === alt)?.data ?? "",
              alt,
              strapiAxios
            );
            return {
              type: "image",
              image: res,
              children: [{ type: "text", text: "" }],
            };
          }
        } catch (err) {
          console.log(err);
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

  uploadBase64OrUrlToStrapi = async (
    data: string,
    name?: string,
    strapiAxios?: AxiosInstance
  ): Promise<any> => {
    try {
      const formData = new FormData();
      let fileBlob: Blob;
      let fileName = name || crypto.randomUUID();
      let extension = "jpg";
      let mime = "image/jpeg";

      if (data.startsWith("data:")) {
        const { blob, mime: detectedMime } = base64ToBlob(data);
        mime = detectedMime;
        extension = mime.split("/")[1]?.split("+")[0] || "jpg";

        if (mime === "image/svg+xml") {
          const svgBuffer = Buffer.from(await blob.arrayBuffer());
          const pngBuffer = await rasterizeSvg(svgBuffer);
          fileBlob = new Blob([pngBuffer], { type: "image/png" });
          extension = "png";
        } else {
          fileBlob = blob;
        }
        formData.append("files", fileBlob, `${fileName}.${extension}`);
      } else if (data.startsWith("http")) {
        const response = await fetch(data);
        if (!response.ok) throw new Error("Failed to fetch image from URL");

        const contentType =
          response.headers.get("content-type") || "image/jpeg";
        mime = contentType;
        extension = contentType.split("/")[1]?.split("+")[0] || "jpg";

        const arrayBuffer = await response.arrayBuffer();

        if (mime === "image/svg+xml") {
          const svgBuffer = Buffer.from(arrayBuffer);
          const pngBuffer = await rasterizeSvg(svgBuffer);
          fileBlob = new Blob([pngBuffer], { type: "image/png" });
          extension = "png";
        } else {
          fileBlob = new Blob([arrayBuffer], { type: mime });
        }

        formData.append("files", fileBlob, `${fileName}.${extension}`);
      } else {
        throw new Error("Invalid image format. Must be base64 or valid URL.");
      }

      if (!strapiAxios) throw new Error("Missing Axios instance");

      const res = await strapiAxios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return res.data[0];
    } catch (err) {
      console.error("Strapi upload error:", err);
      throw err;
    }
  };
}

const base64ToBlob = (base64: string): { blob: Blob; mime: string } => {
  if (!base64.includes(",")) {
    throw new Error("Invalid base64 string: missing comma separator");
  }

  const [meta, data] = base64.split(",");

  const mimeMatch = meta.match(/^data:(.*?);base64$/);
  if (!mimeMatch || !data) {
    throw new Error("Invalid base64 string format");
  }

  const mime = mimeMatch[1];

  let byteCharacters: string;
  try {
    byteCharacters = atob(data);
  } catch (e) {
    throw new Error("Base64 decode failed: invalid characters in string");
  }

  const byteArrays: Uint8Array[] = [];
  for (let i = 0; i < byteCharacters.length; i += 512) {
    const slice = byteCharacters.slice(i, i + 512);
    const byteNumbers = new Array(slice.length);
    for (let j = 0; j < slice.length; j++) {
      byteNumbers[j] = slice.charCodeAt(j);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: mime });
  return { blob, mime };
};
