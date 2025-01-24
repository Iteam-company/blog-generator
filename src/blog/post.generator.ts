import { Readable } from "stream";
import { basename } from "path";

import axios, { AxiosInstance } from "axios";
import FormData from "form-data";

import { MarkdownToStrapiConverter } from "../markdown-parser/markdowntostrapi.parser";
import { OpenaiService } from "../openai/openai.service";
import {
  MarkdownMetadata,
  StrapiArticleRequest,
  StrapiArticleResponce,
  StrapiBlock,
  StrapiImage,
  StrapiImageBlock,
  StrapiImageFormats,
} from "./interfaces/strapi.json.interface";
import { randomString, saveJsonToFile } from "../utils/utils";
import {
  UnsplashImage,
  UnsplashSearchResponse,
} from "./interfaces/unsplash.interface";
import { IT_ARTICLE_DEFAULT } from "../openai/prompts/user-prompts";

export class PostGenerator {
  private openai: OpenaiService;
  private STRAPI_BLOG_URL = "/api/blogs";
  private STRAPI_MEDIA_URL = "/api/upload";
  private UNSPLASH_SEARCH_URL = "/search/photos";
  private STRAPI_TOKEN: string;
  private strapiAxios: AxiosInstance;
  private unsplashAxios: AxiosInstance;

  constructor(strapiToken?: string) {
    this.openai = new OpenaiService();
    this.STRAPI_TOKEN = strapiToken
      ? strapiToken
      : (process.env.STRAPI_TOKEN as string);
    this.strapiAxios = axios.create({
      baseURL: process.env.STRAPI_URL,
      headers: {
        Authorization: `Bearer ${this.STRAPI_TOKEN}`,
      },
    });
    this.unsplashAxios = axios.create({
      baseURL: process.env.UNSPLASH_URL,
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      },
    });
  }

  async generateNewPost(
    prompt: string = IT_ARTICLE_DEFAULT
  ): Promise<StrapiArticleResponce> {
    const aiResponse = await this.openai.getAIResponse(prompt);

    return await this.parseAndPublish(aiResponse);
  }

  async parseAndPublish(
    markdownArticle: string,
    meta?: MarkdownMetadata
  ): Promise<StrapiArticleResponce> {
    await saveJsonToFile("airesponse.md", markdownArticle);

    const converter = new MarkdownToStrapiConverter(markdownArticle, meta);
    const article = converter.convert();

    await saveJsonToFile("article.json", article);

    const processedPost = await this.processImagesInBlogPost(article);

    await saveJsonToFile("processed.json", processedPost);

    const publishedPost = await this.publishThePost(processedPost);
    return publishedPost.data;
  }

  async generateMarkDown(prompt: string = IT_ARTICLE_DEFAULT): Promise<string> {
    const markdown = await this.openai.getAIResponse(prompt);

    await saveJsonToFile("airesponse.md", markdown);

    return markdown;
  }

  async publishThePost(content: StrapiArticleRequest) {
    return await this.strapiAxios.post(this.STRAPI_BLOG_URL, content);
  }

  async searchUnsplash(query: string): Promise<UnsplashImage | null> {
    try {
      const response = await this.unsplashAxios.get<UnsplashSearchResponse>(
        this.UNSPLASH_SEARCH_URL,
        {
          params: {
            query: query,
            per_page: 1,
          },
        }
      );

      return response.data.results[0] || null;
    } catch (error) {
      console.error("Error searching Unsplash:", error);
      return null;
    }
  }

  async uploadImageToStrapi(
    imageUrl: string,
    fileName?: string,
    altText?: string
  ): Promise<StrapiImage> {
    try {
      const imageResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(imageResponse.data, "binary");
      const stream = Readable.from(buffer);
      const formData = new FormData();
      const filename =
        fileName || basename(imageUrl) || `${randomString(12)}.jpg`;

      formData.append("files", stream, {
        filename: filename,
        contentType: imageResponse.headers["content-type"],
      });

      if (altText) {
        formData.append(
          "fileInfo",
          JSON.stringify({ alternativeText: altText })
        );
      }

      const uploadResponse = await this.strapiAxios.post<StrapiImage[]>(
        this.STRAPI_MEDIA_URL,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return uploadResponse.data[0];
    } catch (error) {
      console.error("Error uploading to Strapi:", error);
      throw error;
    }
  }

  async processImagesInBlogPost(
    blogPost: StrapiArticleRequest
  ): Promise<StrapiArticleRequest> {
    const processedPost: StrapiArticleRequest = JSON.parse(
      JSON.stringify(blogPost)
    );

    try {
      // Process preview image if title exists
      if (processedPost.data.title) {
        const previewImage = await this.searchUnsplash(
          processedPost.data.title
        );
        if (previewImage) {
          const uploadedImage = await this.uploadImageToStrapi(
            previewImage.urls.regular,
            previewImage.id,
            previewImage.alt_description || processedPost.data.title
          );
          processedPost.data.previewImage = uploadedImage.id;
        }
      }

      // Process images in the article content
      const processBlock = async (block: StrapiBlock) => {
        if (block.type === "image") {
          const imageBlock = block as StrapiImageBlock;
          const searchQuery =
            imageBlock.image?.alternativeText || processedPost.data.title;

          const unsplashImage = await this.searchUnsplash(searchQuery);
          if (unsplashImage) {
            const uploadedImage = await this.uploadImageToStrapi(
              unsplashImage.urls.regular,
              unsplashImage.id,
              unsplashImage.alt_description || searchQuery
            );
            imageBlock.image = uploadedImage;
          }
        }
        return block;
      };

      // Process all blocks
      processedPost.data.Article = await Promise.all(
        processedPost.data.Article.map(processBlock)
      );

      return processedPost;
    } catch (error) {
      console.error("Error processing blog post images:", error);
      throw error;
    }
  }

  addDomainToImageUrls(image: StrapiImage, domain: string): StrapiImage {
    const processedImage: StrapiImage = { ...image };

    const cleanDomain = domain.endsWith("/") ? domain.slice(0, -1) : domain;

    if (processedImage.url && processedImage.url.startsWith("/")) {
      processedImage.url = `${cleanDomain}${processedImage.url}`;
    }

    if (processedImage.formats) {
      const processedFormats: StrapiImageFormats = {};

      const formatKeys: Array<keyof StrapiImageFormats> = [
        "large",
        "medium",
        "small",
        "thumbnail",
      ];

      formatKeys.forEach((key) => {
        const format = processedImage.formats[key];
        if (format) {
          processedFormats[key] = {
            ...format,
            url: format.url.startsWith("/")
              ? `${cleanDomain}${format.url}`
              : format.url,
          };
        }
      });

      processedImage.formats = processedFormats;
    }

    return processedImage;
  }
}
