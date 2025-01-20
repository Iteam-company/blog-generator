import OpenAI from "openai";
import { Message } from "./interfaces/message.interface";
import { MARKDOWN_FORMATED_BLOG_POST } from "./system-prompts";

export class OpenaiService {
  private openai: OpenAI;
  private MODEL: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.MODEL = process.env.OPENAI_MODEL!;
  }

  async createResponse(messages: Message[]): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      messages: messages,
      model: this.MODEL,
    });
    const content = completion.choices[0].message.content!;

    return content;
  }

  async getAIResponse(
    message?: string,
    systemPrompt: string = MARKDOWN_FORMATED_BLOG_POST
  ): Promise<string> {
    const dialogPart: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message! },
    ];

    const response = await this.createResponse(dialogPart);
    return response;
  }
}
