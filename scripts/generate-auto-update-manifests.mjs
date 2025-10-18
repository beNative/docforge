#!/usr/bin/env node
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) {
      continue;
    }
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key.slice(2)] = value;
      i += 1;
    } else {
      args[key.slice(2)] = true;
    }
  }
  return args;
}

function ensure(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

async function walkFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkFiles(fullPath);
      files.push(...nested);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function computeSha512(filePath) {
  const hash = createHash('sha512');
  const handle = await fs.open(filePath, 'r');
  try {
    const stream = handle.createReadStream();
    await new Promise((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  } finally {
    await handle.close();
  }
  return hash.digest('base64');
}

function yamlQuote(value) {
  if (/^[A-Za-z0-9_.-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function buildManifestContents({ version, fileName, fileSize, sha512, releaseDate }) {
  const quotedName = yamlQuote(fileName);
  return [
    `version: ${version}`,
    'files:',
    `  - url: ${quotedName}`,
    `    sha512: ${sha512}`,
    `    size: ${fileSize}`,
    `path: ${quotedName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${releaseDate}'`,
    'stagingPercentage: "100"',
    ''
  ].join('\n');
}

const targetDefinitions = [
  {
    id: 'windows-x64',
    description: 'Windows x64 NSIS installer',
    outputName: 'latest.yml',
    match(filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      const name = path.basename(normalized).toLowerCase();
      return (
        normalized.includes('docforge-windows-x64') &&
        name.endsWith('.exe') &&
        name.includes('setup') &&
        name !== 'elevate.exe'
      );
    },
    required: true,
  },
  {
    id: 'windows-ia32',
    description: 'Windows ia32 NSIS installer',
    outputName: 'latest-ia32.yml',
    match(filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      const name = path.basename(normalized).toLowerCase();
      return (
        normalized.includes('docforge-windows-ia32') &&
        name.endsWith('.exe') &&
        name.includes('setup') &&
        name !== 'elevate.exe'
      );
    },
    required: false,
  },
  {
    id: 'macos-x64',
    description: 'macOS x64 disk image',
    outputName: 'latest-mac.yml',
    match(filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      const name = path.basename(normalized).toLowerCase();
      return normalized.includes('docforge-macos-x64') && name.endsWith('.dmg');
    },
    required: true,
  },
  {
    id: 'linux-x64',
    description: 'Linux x64 AppImage',
    outputName: 'latest-linux.yml',
    match(filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      const name = path.basename(normalized).toLowerCase();
      return normalized.includes('docforge-linux-x64') && name.endsWith('.appimage');
    },
    required: true,
  },
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactRoot = path.resolve(args['artifact-root'] || 'release-artifacts');
  const version = args.version || JSON.parse(await fs.readFile('package.json', 'utf8')).version;
  ensure(version, 'Unable to determine package version.');

  let releaseDate = args['release-date'];
  if (releaseDate) {
    const parsed = new Date(releaseDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid --release-date value: ${releaseDate}`);
    }
    releaseDate = parsed.toISOString();
  } else {
    releaseDate = new Date().toISOString();
  }

  const rootExists = await fs
    .stat(artifactRoot)
    .then((stats) => stats.isDirectory())
    .catch(() => false);
  if (!rootExists) {
    throw new Error(`Artifact root ${artifactRoot} does not exist.`);
  }

  const allFiles = await walkFiles(artifactRoot);
  if (allFiles.length === 0) {
    throw new Error(`No files were found beneath ${artifactRoot}.`);
  }

  const results = [];
  for (const target of targetDefinitions) {
    const candidates = allFiles.filter((filePath) => target.match(filePath));
    if (candidates.length === 0) {
      if (target.required) {
        throw new Error(`Unable to locate ${target.description} within ${artifactRoot}.`);
      }
      console.warn(`Skipping optional target ${target.id}; no matching files were found.`);
      continue;
    }

    if (candidates.length > 1) {
      candidates.sort((a, b) => a.localeCompare(b));
    }

    const selected = candidates[0];
    const stat = await fs.stat(selected);
    const sha512 = await computeSha512(selected);
    const fileName = path.basename(selected);
    const manifestContents = buildManifestContents({
      version,
      fileName,
      fileSize: stat.size,
      sha512,
      releaseDate,
    });
    const outputPath = path.join(path.dirname(selected), target.outputName);
    await fs.writeFile(outputPath, manifestContents, 'utf8');
    console.log(`Generated ${target.outputName} for ${target.description}: ${path.relative(artifactRoot, selected)}`);
    results.push(outputPath);
  }

  if (results.length === 0) {
    throw new Error('No auto-update manifests were generated.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
