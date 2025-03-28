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
  private STRAPI_ARTICLE_META_URL = "/api/article-generation";
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

  async generateNewPost(prompt?: string): Promise<StrapiArticleResponce> {
    const aiResponse = await this.generateMarkDown(prompt);

    return await this.parseAndPublish(aiResponse);
  }

  async parseAndPublish(
    markdownArticle: string,
    images: { name: string; data: string }[] = [],
    meta?: MarkdownMetadata
  ): Promise<StrapiArticleResponce> {
    await saveJsonToFile("airesponse.md", markdownArticle);

    const converter = new MarkdownToStrapiConverter(markdownArticle, meta);
    const { metadata, content } = converter.getData();
    const article = await converter.convert(images, this.strapiAxios);

    await saveJsonToFile("article.json", article);

    const articlesMeta = await this.getStrapiData();
    const exisitigTitles = articlesMeta.attributes.exisitigTitles || [];
    await this.strapiAxios.put(this.STRAPI_ARTICLE_META_URL, {
      data: {
        exisitigTitles: [...exisitigTitles, { name: metadata.title }],
      },
    });

    const processedPost = await this.processImagesInBlogPost(article);

    await saveJsonToFile("processed.json", processedPost);

    const publishedPost = await this.publishThePost(processedPost);
    return publishedPost.data;
  }

  async generateMarkDown(prompt?: string): Promise<string> {
    let userPrompt: string;
    if (prompt) {
      userPrompt =
        prompt + "-- is a topic on which you need to generate post. ";
    } else {
      userPrompt = await this.getPrompt();
    }

    const strapiMeta = await this.getStrapiData();
    const referenceCategories =
      strapiMeta.attributes.exisitigTitles
        .map((elem: any) => elem.name)
        .join(", ") || "";

    userPrompt += `Here is existing titles, avoid this topics in the next post: ${referenceCategories}`;
    console.log(userPrompt);

    const markdown = await this.openai.getAIResponse(userPrompt);

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
      // const processBlock = async (block: StrapiBlock) => {
      //   if (block.type === 'image') {
      //     const imageBlock = block as StrapiImageBlock;
      //     const searchQuery =
      //       imageBlock.image?.alternativeText || processedPost.data.title;

      //     const unsplashImage = await this.searchUnsplash(searchQuery);
      //     if (unsplashImage) {
      //       const uploadedImage = await this.uploadImageToStrapi(
      //         unsplashImage.urls.regular,
      //         unsplashImage.id,
      //         unsplashImage.alt_description || searchQuery
      //       );
      //       imageBlock.image = uploadedImage;
      //     }
      //   }
      //   return block;
      // };

      // // Process all blocks
      // processedPost.data.Article = await Promise.all(
      //   processedPost.data.Article.map(processBlock)
      // );

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

  async getPrompt() {
    const strapiMeta = await this.getStrapiData();
    const referenceCategories = strapiMeta.attributes.referenceCategory
      .map((elem: any) => elem.name)
      .join(", ");
    return IT_ARTICLE_DEFAULT.replace("---categories---", referenceCategories);
  }

  async getStrapiData() {
    return await this.strapiAxios
      .get(this.STRAPI_ARTICLE_META_URL + "?populate=deep")
      .then((res) => res.data.data);
  }
}
