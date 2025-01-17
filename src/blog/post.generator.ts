import { Readable } from "stream";
import { basename } from "path";

import { writeFile } from "fs";
import { promisify } from "util";
import { randomBytes } from "crypto";

import axios from "axios";
import FormData from "form-data";

import { HtmlToStrapiConverter } from "../html-parser/htmltostrapi.parser";
import { OpenaiService } from "../openai/openai.service";
import {
  StrapiArticleRequest,
  StrapiArticleResponce,
  StrapiBlock,
  StrapiImage,
  StrapiImageBlock,
  StrapiImageFormat,
  StrapiImageFormats,
} from "../html-parser/interfaces/strapi.json.interface";

const writeFileAsync = promisify(writeFile);

const saveJsonToFile = async (
  fileName: string,
  data: object,
  flag: string = "w"
) => {
  try {
    const jsonData = JSON.stringify(data, null, 2); // Beautify JSON with 2-space indentation
    const filePath = `./${fileName}`;
    await writeFileAsync(filePath, jsonData, { encoding: "utf-8", flag: flag });
    console.log(`File saved successfully at ${filePath}`);
  } catch (error) {
    console.error("Error writing JSON file:", error);
  }
};

interface UnsplashImage {
  id?: string;
  urls: {
    regular: string;
    small: string;
  };
  alt_description: string | null;
  description: string | null;
}

interface PromptedJSONResponce {
  title: string;
  category: string;
  previewDescription: string;
  body: string;
}

function randomString(length: number) {
  if (length % 2 !== 0) {
    length++;
  }

  return randomBytes(length / 2).toString("hex");
}

interface UnsplashSearchResponse {
  results: UnsplashImage[];
}

export class PostGenerator {
  private openai: OpenaiService;
  private STRAPI_BLOG_URL = "/api/blogs";
  private STRAPI_MEDIA_URL = "/api/upload";
  private UNSPLASH_SEARCH_URL = "/search/photos";

  private strapiAxios = axios.create({
    baseURL: process.env.STRAPI_URL,
    headers: {
      Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
    },
  });

  private unsplashAxios = axios.create({
    baseURL: process.env.UNSPLASH_URL,
    headers: {
      Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
    },
  });

  constructor() {
    this.openai = new OpenaiService();
  }

  async generateNewPost(prompt: string): Promise<StrapiArticleResponce> {
    let userPrompt = prompt;
    if (!userPrompt) {
      userPrompt = "Generate an article about React with TypeScript.";
    }

    const aiResponse = await this.openai.getAIResponse(userPrompt);

    let parsedReponse: PromptedJSONResponce;
    try {
      parsedReponse = JSON.parse(aiResponse);
    } catch {
      const cleanedAiResponse = aiResponse.replace(
        /^```json\n|^```\n|```$/g,
        ""
      );
      parsedReponse = JSON.parse(cleanedAiResponse);
    }

    // await saveJsonToFile("airesponse.json", parsedReponse);

    const { title, category, previewDescription, body } = parsedReponse;

    const converter = new HtmlToStrapiConverter(body);
    const article = converter.createArticle(body, {
      title,
      category,
      previewDescription,
      previewImage: 34,
    });

    // await saveJsonToFile("article.json", article);

    const processedPost = await this.processImagesInBlogPost(article);

    // await saveJsonToFile("processed.json", processedPost);

    const publishedPost = await this.publishThePost(processedPost);
    return publishedPost.data;
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
    altText: string,
    fileName?: string
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
        formData.append("alternativeText", altText);
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
            previewImage.alt_description || processedPost.data.title,
            previewImage.id
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
              unsplashImage.alt_description || searchQuery,
              unsplashImage.id
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
