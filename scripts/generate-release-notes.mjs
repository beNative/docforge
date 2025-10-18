#!/usr/bin/env node
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import crypto from 'crypto';
import YAML from 'yaml';

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

async function readChangelogEntry(changelogPath, version) {
  const source = await fs.readFile(changelogPath, 'utf8');
  const heading = `## v${version}`;
  const start = source.indexOf(heading);
  if (start === -1) {
    throw new Error(`Unable to locate changelog entry for v${version} in ${changelogPath}`);
  }
  const afterHeading = source.slice(start);
  const nextHeadingIndex = afterHeading.indexOf('\n## ');
  const entry = nextHeadingIndex === -1
    ? afterHeading
    : afterHeading.slice(0, nextHeadingIndex);
  return entry.trimEnd();
}

async function walkFiles(directory) {
  const results = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkFiles(fullPath);
      results.push(...nested);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function normaliseArch(value) {
  const map = {
    x64: 'x64',
    ia32: 'ia32',
    arm64: 'ARM64',
    armv7l: 'ARMv7l',
  };
  return map[value] ?? value;
}

function normalisePlatform(value) {
  const map = {
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
  };
  return map[value] ?? value;
}

function detectFormat(filename) {
  if (filename.endsWith('.exe')) {
    return 'NSIS Installer (.exe)';
  }
  if (filename.endsWith('.dmg')) {
    return 'Disk Image (.dmg)';
  }
  if (filename.endsWith('.AppImage')) {
    return 'AppImage (.AppImage)';
  }
  if (filename.endsWith('.deb')) {
    return 'Debian Package (.deb)';
  }
  if (filename.endsWith('.tar.gz')) {
    return 'Tarball (.tar.gz)';
  }
  if (filename.endsWith('.zip')) {
    return 'Archive (.zip)';
  }
  return 'Binary';
}

function isReleaseAsset(filename) {
  if (filename.toLowerCase() === 'elevate.exe') {
    return false;
  }

  return (
    filename.endsWith('.exe') ||
    filename.endsWith('.dmg') ||
    filename.endsWith('.AppImage') ||
    filename.endsWith('.deb') ||
    filename.endsWith('.tar.gz') ||
    filename.endsWith('.zip')
  );
}

function isAutoUpdateSupportFile(filename) {
  if (filename === 'builder-debug.yml') {
    return false;
  }
  if (filename.endsWith('.blockmap')) {
    return true;
  }

  if (!filename.endsWith('.yml')) {
    return false;
  }

  // Electron Builder always publishes metadata files with a `.yml` extension
  // alongside the installers (for example `latest.yml` on Windows). Without
  // these files the auto-updater cannot determine the latest available
  // version, which is the issue we are addressing.
  return true;
}

function normaliseInstallerFileName(fileName) {
  if (!fileName.toLowerCase().endsWith('.exe')) {
    return fileName;
  }

  const extension = path.extname(fileName);
  const baseName = fileName.slice(0, -extension.length);

  const normalisedBase = baseName
    .replace(/^DocForge[\s._-]*Setup[\s._-]*/i, 'DocForge-Setup-')
    .replace(/[\s_]+/g, '-')
    .replace(/\.Setup\.?/i, '-Setup-')
    .replace(/-+/g, '-')
    .replace(/-$/g, '');

  const normalisedName = `${normalisedBase}${extension}`;
  return normalisedName;
}

async function normaliseReleaseAsset(filePath) {
  const fileName = path.basename(filePath);
  const normalisedName = normaliseInstallerFileName(fileName);
  if (normalisedName === fileName) {
    return { filePath, fileName, originalFileName: fileName };
  }

  const targetPath = path.join(path.dirname(filePath), normalisedName);
  await fs.rename(filePath, targetPath);
  console.log(`Normalised release asset name: ${fileName} -> ${normalisedName}`);
  return { filePath: targetPath, fileName: normalisedName, originalFileName: fileName };
}

async function computeSha512(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('base64')));
  });
}

async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

async function collectAssets(artifactRoot) {
  const releaseAssets = [];
  const updateSupportFiles = [];
  const rootEntries = await fs.readdir(artifactRoot, { withFileTypes: true });
  for (const rootEntry of rootEntries) {
    if (!rootEntry.isDirectory()) {
      continue;
    }
    const dirName = rootEntry.name;
    const parts = dirName.split('-').slice(1); // drop leading docforge
    if (parts.length === 0) {
      continue;
    }
    const platformKey = parts[0];
    const platform = normalisePlatform(platformKey);
    const arch = normaliseArch(parts.slice(1).join('-') || parts[0]);
    const files = await walkFiles(path.join(artifactRoot, dirName));
    for (const file of files) {
      const { filePath: normalisedPath, fileName: normalisedName, originalFileName } = await normaliseReleaseAsset(file);
      const fileName = normalisedName;
      const filePath = normalisedPath;
      if (isAutoUpdateSupportFile(fileName)) {
        updateSupportFiles.push(filePath);
        continue;
      }

      if (!isReleaseAsset(fileName)) {
        continue;
      }

      const [sha512, size] = await Promise.all([
        computeSha512(filePath),
        getFileSize(filePath),
      ]);

      releaseAssets.push({
        platform,
        arch,
        fileName,
        filePath,
        originalFileName,
        format: detectFormat(fileName),
        sha512,
        size,
      });
    }
  }
  if (releaseAssets.length === 0) {
    throw new Error(`No release-ready binaries were found in ${artifactRoot}`);
  }
  releaseAssets.sort((a, b) => {
    const platformCompare = a.platform.localeCompare(b.platform);
    if (platformCompare !== 0) {
      return platformCompare;
    }
    const archCompare = a.arch.localeCompare(b.arch);
    if (archCompare !== 0) {
      return archCompare;
    }
    return a.fileName.localeCompare(b.fileName);
  });
  updateSupportFiles.sort();
  return { releaseAssets, updateSupportFiles };
}

async function updateMetadataFiles(metadataFiles, releaseAssets) {
  if (metadataFiles.length === 0) {
    return;
  }

  const assetByName = new Map();
  for (const asset of releaseAssets) {
    assetByName.set(asset.fileName, asset);
    const originalName = asset.originalFileName;
    if (originalName && originalName !== asset.fileName && !assetByName.has(originalName)) {
      assetByName.set(originalName, asset);
    }
  }

  const ensureEntryMatchesAsset = (entry) => {
    if (!entry) {
      return false;
    }
    const key = entry.url || entry.path;
    if (!key) {
      return false;
    }
    let asset = assetByName.get(key);
    if (!asset) {
      const normalisedKey = normaliseInstallerFileName(key);
      if (normalisedKey !== key && assetByName.has(normalisedKey)) {
        asset = assetByName.get(normalisedKey);
      }
    }
    if (!asset) {
      return false;
    }
    let changed = false;
    if (entry.url && entry.url !== asset.fileName) {
      entry.url = asset.fileName;
      changed = true;
    }
    if (entry.path && entry.path !== asset.fileName) {
      entry.path = asset.fileName;
      changed = true;
    }
    if (typeof asset.size === 'number' && entry.size !== asset.size) {
      entry.size = asset.size;
      changed = true;
    }
    if (asset.sha512 && entry.sha512 !== asset.sha512) {
      entry.sha512 = asset.sha512;
      changed = true;
    }
    return changed;
  };

  for (const metadataPath of metadataFiles) {
    let parsed;
    try {
      const source = await fs.readFile(metadataPath, 'utf8');
      parsed = YAML.parse(source);
    } catch (error) {
      console.warn(`Failed to parse auto-update metadata at ${metadataPath}:`, error);
      continue;
    }

    if (!parsed || typeof parsed !== 'object') {
      continue;
    }

    let changed = false;

    if (Array.isArray(parsed.files)) {
      for (const entry of parsed.files) {
        if (ensureEntryMatchesAsset(entry)) {
          changed = true;
        }
      }
    }

    const primaryKey =
      (typeof parsed.path === 'string' && parsed.path) ||
      (Array.isArray(parsed.files) && parsed.files[0] && (parsed.files[0].path || parsed.files[0].url));

    if (primaryKey) {
      const asset = assetByName.get(primaryKey);
      if (asset) {
        if (parsed.path !== asset.fileName) {
          parsed.path = asset.fileName;
          changed = true;
        }
        if (asset.sha512 && parsed.sha512 !== asset.sha512) {
          parsed.sha512 = asset.sha512;
          changed = true;
        }
        if (typeof asset.size === 'number' && parsed.size !== undefined && parsed.size !== asset.size) {
          parsed.size = asset.size;
          changed = true;
        }
      }
    }

    if (!parsed.sha512 && parsed.path && assetByName.has(parsed.path)) {
      parsed.sha512 = assetByName.get(parsed.path).sha512;
      changed = true;
    }

    if (!Array.isArray(parsed.files) && parsed.path && assetByName.has(parsed.path)) {
      parsed.files = [
        {
          url: parsed.path,
          sha512: parsed.sha512,
          size: assetByName.get(parsed.path).size,
        },
      ];
      changed = true;
    }

    if (!changed) {
      continue;
    }

    const serialised = YAML.stringify(parsed, { lineWidth: 0 }).trimEnd();
    await fs.writeFile(metadataPath, `${serialised}\n`, 'utf8');
    console.log(`Updated auto-update metadata checksums in ${metadataPath}`);
  }
}

function buildDownloadTable(entries, repo, tag) {
  const header = ['| Platform | Architecture | Format | Download |', '| --- | --- | --- | --- |'];
  const rows = entries.map((entry) => {
    const downloadUrl = `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(entry.fileName)}`;
    const link = `[${entry.fileName}](${downloadUrl})`;
    return `| ${entry.platform} | ${entry.arch} | ${entry.format} | ${link} |`;
  });
  return header.concat(rows).join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tag = ensure(args.tag || process.env.TAG_NAME, 'A tag must be provided via --tag or TAG_NAME');
  const version = ensure(args.version || process.env.PACKAGE_VERSION, 'A package version must be provided via --version or PACKAGE_VERSION');
  const artifactRoot = args['artifact-root'] || 'release-artifacts';
  const changelogPath = args.changelog || 'docs/VERSION_LOG.md';
  const outputPath = args.output || 'release-notes.md';
  const filesOutputPath = args['files-output'] || 'release-files.txt';
  const repository = ensure(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY environment variable is required');

  const changelogEntry = await readChangelogEntry(changelogPath, version);
  const entryLines = changelogEntry.split('\n');
  const headingLine = entryLines.shift()?.replace(/^##\s*/, '').trim() ?? '';
  const body = entryLines.join('\n').trim();

  const { releaseAssets, updateSupportFiles } = await collectAssets(artifactRoot);
  await updateMetadataFiles(updateSupportFiles, releaseAssets);
  const table = buildDownloadTable(releaseAssets, repository, tag);

  const sections = [`# DocForge v${version}`];
  if (headingLine) {
    sections.push('', `_${headingLine}_`);
  }
  if (body) {
    sections.push('', body);
  }
  sections.push('', '## Downloads', '', table);
  sections.push('', '> Verify the downloaded installer before running it in your environment.');

  const releaseNotes = sections.join('\n').replace(/\n{3,}/g, '\n\n');
  await fs.writeFile(outputPath, `${releaseNotes}\n`, 'utf8');

  const manifestEntries = [
    ...releaseAssets.map((asset) => path.relative(process.cwd(), asset.filePath)),
    ...updateSupportFiles.map((filePath) => path.relative(process.cwd(), filePath)),
  ];
  const manifest = manifestEntries.join('\n');
  await fs.writeFile(filesOutputPath, `${manifest}\n`, 'utf8');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
