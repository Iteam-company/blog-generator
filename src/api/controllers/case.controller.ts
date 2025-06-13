import axios from 'axios';
import { Request, Response } from 'express';
import { OpenAI } from 'openai';
import { JSON_FORMATED_CASE } from "../../openai/prompts/case-prompts";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

export class CaseController {
    async generateCase(req: Request, res: Response): Promise<void> {
        const userPrompt = req.body.prompt;

        if (!userPrompt) {
            res.status(400).json({ error: 'Prompt is required' });
            return;
        }

        try {
            const systemMessage = {
                role: 'system' as const,
                content: JSON_FORMATED_CASE,
            };

            const completion = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [systemMessage, { role: 'user', content: userPrompt }],
                temperature: 0.2,
            });

            const gptResponse = completion.choices[0].message.content;

            if (!gptResponse) {
                res.status(500).json({
                    error: 'Empty response from GPT.',
                });
                return;
            }

            const cleanedJson = extractJson(gptResponse).trim();

            let parsedJson;
            try {
                parsedJson = JSON.parse(cleanedJson);
            } catch (err) {
                res.status(500).json({
                    error: 'Invalid JSON returned by GPT',
                    details: (err as Error).message,
                    raw: gptResponse,
                });
                return;
            }

            const strapiRes = await axios.post(
                process.env.STRAPI_URL! + '/api/cases',
                { data: parsedJson },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
                    },
                }
            );

            res.status(200).json({
                message: 'Case created and posted to Strapi successfully',
                strapi: strapiRes.data,
            });
        } catch (err: any) {
            console.error('generateCase error:', err);

            if (err.response) {
                res.status(err.response.status).json({
                    error: 'Strapi returned an error',
                    details: err.response.data,
                });

                return;
            }

            res.status(500).json({
                error: 'Something went wrong while generating or saving the case.',
                details: err.message,
            });

            return;
        }

    }
}

function extractJson(text: string): string {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    return codeBlockMatch ? codeBlockMatch[1] : text;
}
