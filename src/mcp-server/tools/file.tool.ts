import fs from 'node:fs/promises';
import path from 'node:path';

export const handleFileReader = async (filePath: string) => {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const fileContent = await fs.readFile(resolvedPath, 'utf8');
  return fileContent;
};
