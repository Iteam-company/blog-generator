import { InputData } from "./interfaces/article.template.interface";

export function fillJSONTemplate<T extends object>(
  inputData: InputData,
  template: T
): T {
  // Deep clone the template to avoid modifying the original
  const filledTemplate = JSON.parse(JSON.stringify(template)) as T;

  // Helper function to replace placeholder values recursively
  function replacePlaceholders(obj: any): any {
    if (typeof obj === "string" && obj.startsWith("<") && obj.endsWith(">")) {
      const key = obj.slice(1, -1); // Remove < and >
      return inputData[key] || obj; // Return original if no matching value found
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => replacePlaceholders(item));
    }

    if (typeof obj === "object" && obj !== null) {
      const newObj: { [key: string]: any } = {};
      for (const [key, value] of Object.entries(obj)) {
        newObj[key] = replacePlaceholders(value);
      }
      return newObj;
    }

    return obj;
  }

  return replacePlaceholders(filledTemplate);
}
