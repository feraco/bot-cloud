export interface ParsedRosMapYaml {
  image?: string;
  resolution?: number;
  origin?: [number, number, number];
}

function parseNumber(value: string): number | undefined {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseRosMapYaml(yamlText: string): ParsedRosMapYaml {
  const parsed: ParsedRosMapYaml = {};

  for (const rawLine of yamlText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key === 'image') {
      parsed.image = value.replace(/^['"]|['"]$/g, '');
      continue;
    }

    if (key === 'resolution') {
      parsed.resolution = parseNumber(value);
      continue;
    }

    if (key === 'origin') {
      const match = value.match(/^\[(.+)\]$/);
      if (!match) {
        continue;
      }

      const parts = match[1]
        .split(',')
        .map((part) => parseNumber(part))
        .filter((part): part is number => part !== undefined);

      if (parts.length === 3) {
        parsed.origin = [parts[0], parts[1], parts[2]];
      }
    }
  }

  return parsed;
}