import { readFile } from 'node:fs/promises';

import YAML from 'yaml';

export async function loadYamlFile(path: string): Promise<unknown> {
  const fileContents = await readFile(path, 'utf8');
  return YAML.parse(fileContents);
}
