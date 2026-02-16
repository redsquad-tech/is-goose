import fs from 'node:fs';
import path from 'node:path';
import type { DistributionConfig } from './types';

const CONFIG_FILE = 'distribution-config.json';

const candidatePaths = (): string[] => {
  const paths: string[] = [];

  if (process.resourcesPath) {
    paths.push(path.join(process.resourcesPath, 'distribution', CONFIG_FILE));
  }

  paths.push(
    path.join(process.cwd(), 'src', 'distribution', CONFIG_FILE),
    path.join(__dirname, '..', 'distribution', CONFIG_FILE),
    path.join(__dirname, 'distribution', CONFIG_FILE)
  );

  return paths;
};

export const loadDistributionConfig = (): DistributionConfig | null => {
  for (const filePath of candidatePaths()) {
    try {
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content) as DistributionConfig;

      if (!parsed.distro_id || !parsed.distro_version) {
        continue;
      }

      return parsed;
    } catch {
      continue;
    }
  }

  return null;
};
