import { writeFile, existsSync, mkdirSync, readFile } from "fs";
import { promisify } from "util";
import { randomBytes } from "crypto";

const writeFileAsync = promisify(writeFile);
const readTextFile = promisify(readFile);

export async function saveJsonToFile(
  fileName: string,
  data: string | object,
  flag: string = "w"
) {
  try {
    let stringData: string;
    if (typeof data === "string") {
      stringData = data;
    } else {
      stringData = JSON.stringify(data, null, 2);
    }
    const dirPath = `./src/text-files`;
    const filePath = `./src/text-files/${fileName}`;
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    await writeFileAsync(filePath, stringData, {
      encoding: "utf-8",
      flag: flag,
    });
    console.log(`File saved successfully at ${filePath}`);
  } catch (error) {
    console.error("Error writing JSON file:", error);
  }
}

export async function readFileContent(fileName: string): Promise<string> {
  const filePath = `./src/text-files/${fileName}`;
  const content = await readTextFile(filePath, "utf8");
  return content;
}

export function randomString(length: number) {
  if (length % 2 !== 0) {
    length++;
  }
  return randomBytes(length / 2).toString("hex");
}
