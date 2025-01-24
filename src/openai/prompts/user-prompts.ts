import axios from "axios";

export const CATEGORIES_DEFAULT = `Frontend, It, Angular, React, Asap, Framer Motion, Vercel, SSR, Landing, SPA, SAAS, PWA, React Native, Mobile development, Microservices`;

export const IT_ARTICLE_DEFAULT =
  "Generate an article based on 1-3 of these categories: ```categories```. Give some code examples.";

export const getPrompt = async () => {
  return IT_ARTICLE_DEFAULT.replace(
    "```categories```",
    (await getStrapiData()).attributes.referenceCategory
      .map((elem: any, i: number) => elem.name)
      .join(", ")
  );
};

export const getStrapiData = async () => {
  return await axios
    .get(
      "https://itm-strapi.onrender.com/api/article-generation?populate=deep",
      {
        headers: {
          Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
        },
      }
    )
    .then((res) => res.data.data);
};
