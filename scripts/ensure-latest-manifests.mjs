#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import process from 'process';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) {
      continue;
    }
    const value = argv[index + 1];
    if (value && !value.startsWith('--')) {
      args[key.slice(2)] = value;
      index += 1;
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

async function findInstallerFile(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const nested = await findInstallerFile(path.join(directory, entry.name));
      if (nested) {
        candidates.push(nested);
      }
      continue;
    }

    if (entry.name.toLowerCase().endsWith('.exe')) {
      const fullPath = path.join(directory, entry.name);
      candidates.push(fullPath);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const aName = path.basename(a).toLowerCase();
    const bName = path.basename(b).toLowerCase();
    const aIsSetup = aName.includes('setup');
    const bIsSetup = bName.includes('setup');
    if (aIsSetup !== bIsSetup) {
      return aIsSetup ? -1 : 1;
    }
    return a.localeCompare(b);
  });

  return candidates[0];
}

async function hasManifest(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (await hasManifest(path.join(directory, entry.name))) {
        return true;
      }
      continue;
    }
    if (entry.name.toLowerCase() === 'latest.yml') {
      return true;
    }
  }
  return false;
}

function buildManifestContent({ version, fileName, sha512, size, releaseDate }) {
  return [
    `version: ${version}`,
    'files:',
    `  - url: ${fileName}`,
    `    sha512: ${sha512}`,
    `    size: ${size}`,
    `path: ${fileName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${releaseDate}'`,
    ''
  ].join('\n');
}

async function createManifest(directory, { version }) {
  const manifestAlreadyExists = await hasManifest(directory);
  if (manifestAlreadyExists) {
    return null;
  }

  const installerPath = await findInstallerFile(directory);
  if (!installerPath) {
    console.warn(`No Windows installer found in ${directory}; skipping latest.yml generation.`);
    return null;
  }

  const [fileBuffer, stats] = await Promise.all([
    fs.readFile(installerPath),
    fs.stat(installerPath)
  ]);

  const sha512 = crypto.createHash('sha512').update(fileBuffer).digest('base64');
  const releaseDate = new Date(stats.mtime).toISOString();
  const fileName = path.basename(installerPath);
  const content = buildManifestContent({ version, fileName, sha512, size: stats.size, releaseDate });
  const manifestPath = path.join(path.dirname(installerPath), 'latest.yml');
  await fs.writeFile(manifestPath, content, 'utf8');
  return manifestPath;
}

async function walkWindowsArtifacts(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const windowsDirectories = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('docforge-windows-'))
    .map((entry) => path.join(root, entry.name));
  return windowsDirectories;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactRoot = path.resolve(args['artifact-root'] || 'release-artifacts');
  const version = ensure(args.version || process.env.PACKAGE_VERSION, 'Package version must be provided via --version or PACKAGE_VERSION');

  const windowsDirectories = await walkWindowsArtifacts(artifactRoot);
  if (windowsDirectories.length === 0) {
    console.log(`No Windows artifacts found in ${artifactRoot}; nothing to do.`);
    return;
  }

  const generated = [];
  for (const directory of windowsDirectories) {
    const manifestPath = await createManifest(directory, { version });
    if (manifestPath) {
      generated.push(manifestPath);
      console.log(`Generated ${manifestPath}`);
    } else {
      console.log(`Manifest already present for ${directory}; skipping.`);
    }
  }

  if (generated.length === 0) {
    console.log('No latest.yml manifests were generated.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
