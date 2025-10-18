#!/usr/bin/env node
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import path from 'path';
import process from 'process';
import { promisify } from 'util';

const DEFAULT_OWNER = 'beNative';
const DEFAULT_REPO = 'docforge';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) {
      continue;
    }
    const normalizedKey = key.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[normalizedKey] = true;
    } else {
      args[normalizedKey] = next;
      index += 1;
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
  return `${normalisedBase}${extension}`;
}

function extractMetadataReferences(source) {
  const references = new Set();
  const lines = source.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const match = trimmed.match(/^(?:-\s*)?(url|path):\s*(.+)$/i);
    if (!match) {
      continue;
    }
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    if (!value || value.startsWith('http')) {
      continue;
    }
    references.add(value);
  }
  return Array.from(references);
}

const execFileAsync = promisify(execFile);

async function curlGet(url, headers) {
  const args = ['-sS', '-L', '--fail-with-body'];
  for (const [key, value] of Object.entries(headers)) {
    args.push('-H', `${key}: ${value}`);
  }
  args.push(url);
  const { stdout } = await execFileAsync('curl', args);
  return stdout;
}

async function curlHead(url, headers) {
  const args = ['-sS', '-L', '-I', '-o', '/dev/null', '-w', '%{http_code}'];
  for (const [key, value] of Object.entries(headers)) {
    args.push('-H', `${key}: ${value}`);
  }
  args.push(url);
  try {
    const { stdout } = await execFileAsync('curl', args);
    const status = Number(stdout.trim());
    return { ok: status >= 200 && status < 400, status };
  } catch (error) {
    const statusOutput = typeof error.stdout === 'string' ? Number(error.stdout.trim()) : 0;
    return { ok: false, status: statusOutput, error };
  }
}

async function fetchJson(url, headers) {
  const body = await curlGet(url, headers);
  return JSON.parse(body);
}

async function fetchText(url, headers) {
  return curlGet(url, headers);
}

async function headRequest(url, headers) {
  return curlHead(url, headers);
}

function buildDownloadUrl(owner, repo, tag, fileName) {
  return `https://github.com/${owner}/${repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`;
}

function reportIssue(prefix, values) {
  for (const value of values) {
    console.log(`  - ${prefix}${value}`);
  }
}

async function analyseMetadataEntry({
  metadataName,
  metadataSource,
  owner,
  repo,
  tag,
  assets,
  skipHttp,
}) {
  const references = extractMetadataReferences(metadataSource);
  const missing = [];
  const unreachable = [];
  const suggestions = [];

  for (const reference of references) {
    const asset = assets.get(reference);
    if (!asset) {
      const candidate = Array.from(assets.keys()).find((name) => normaliseInstallerFileName(name) === reference);
      missing.push(reference);
      if (candidate) {
        suggestions.push(`${reference} -> ${candidate}`);
      }
      continue;
    }
    if (!skipHttp) {
      const downloadUrl = buildDownloadUrl(owner, repo, tag, reference);
      const { ok, status, error } = await headRequest(downloadUrl, {
        'User-Agent': 'docforge-auto-update-tester',
      });
      if (!ok) {
        const detail = error instanceof Error ? `${status || 'ERR'} (${error.message})` : String(status || 'ERR');
        unreachable.push(`${reference} - ${detail}`);
      }
    }
  }

  console.log(`\nMetadata: ${metadataName}`);
  console.log(`  Referenced files: ${references.length}`);
  if (missing.length === 0) {
    console.log('  ✓ All referenced files are present in the release assets.');
  } else {
    console.log('  ✗ Missing assets detected:');
    reportIssue('', missing);
  }

  if (unreachable.length > 0) {
    console.log('  ✗ HTTP availability issues:');
    reportIssue('', unreachable);
  }

  if (suggestions.length > 0) {
    console.log('  Suggested filename normalisations:');
    reportIssue('', suggestions);
  }

  return { missing, unreachable };
}

async function runRemoteCheck({ owner, repo, tag, skipHttp }) {
  const headers = {
    'User-Agent': 'docforge-auto-update-tester',
    Accept: 'application/vnd.github+json',
  };
  const release = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`, headers);
  const assetEntries = release.assets ?? [];
  if (assetEntries.length === 0) {
    throw new Error(`No assets found for ${owner}/${repo} ${tag}.`);
  }

  const assetMap = new Map(assetEntries.map((asset) => [asset.name, asset]));
  const metadataAssets = assetEntries.filter((asset) => asset.name.endsWith('.yml') && asset.name !== 'builder-debug.yml');
  if (metadataAssets.length === 0) {
    throw new Error('No update metadata (.yml) files were found in the release.');
  }

  console.log(`Auto-update asset verification for ${owner}/${repo} ${tag}`);
  console.log(`Found ${assetEntries.length} total assets and ${metadataAssets.length} metadata files.`);

  let failures = false;
  for (const asset of metadataAssets) {
    const content = await fetchText(asset.browser_download_url, { 'User-Agent': 'docforge-auto-update-tester' });
    const { missing, unreachable } = await analyseMetadataEntry({
      metadataName: asset.name,
      metadataSource: content,
      owner,
      repo,
      tag,
      assets: assetMap,
      skipHttp,
    });
    if (missing.length > 0 || unreachable.length > 0) {
      failures = true;
    }
  }

  if (failures) {
    throw new Error('Auto-update verification failed. See details above.');
  }

  console.log('\nAll metadata files reference available and reachable assets.');
}

async function runLocalCheck({ directory }) {
  const resolvedDirectory = path.resolve(directory);
  const entries = await fs.readdir(resolvedDirectory);
  const metadataFiles = entries.filter((entry) => entry.endsWith('.yml'));
  if (metadataFiles.length === 0) {
    throw new Error(`No metadata files were found in ${resolvedDirectory}`);
  }

  console.log(`Auto-update asset verification for local directory ${resolvedDirectory}`);
  console.log(`Found ${metadataFiles.length} metadata file(s).`);

  let failures = false;
  for (const metadataFile of metadataFiles) {
    const metadataPath = path.join(resolvedDirectory, metadataFile);
    const source = await fs.readFile(metadataPath, 'utf8');
    const references = extractMetadataReferences(source);
    const missing = [];
    for (const reference of references) {
      const targetPath = path.join(resolvedDirectory, reference);
      try {
        await fs.access(targetPath);
      } catch {
        missing.push(reference);
      }
    }
    console.log(`\nMetadata: ${metadataFile}`);
    console.log(`  Referenced files: ${references.length}`);
    if (missing.length > 0) {
      failures = true;
      console.log('  ✗ Missing assets:');
      reportIssue('', missing);
    } else {
      console.log('  ✓ All referenced files exist locally.');
    }
  }

  if (failures) {
    throw new Error('Local auto-update verification failed.');
  }

  console.log('\nAll local metadata files reference existing assets.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const localDir = args.local ?? null;
  const skipHttp = Boolean(args['skip-http']);

  if (localDir) {
    await runLocalCheck({ directory: localDir });
    return;
  }

  const owner = args.owner ?? DEFAULT_OWNER;
  const repo = args.repo ?? DEFAULT_REPO;

  let tag = args.tag ?? null;
  if (!tag) {
    const versionArg = args.version ?? null;
    if (versionArg) {
      tag = versionArg.startsWith('v') ? versionArg : `v${versionArg}`;
    } else {
      const packageSource = await fs.readFile(new URL('../package.json', import.meta.url), 'utf8');
      const pkg = JSON.parse(packageSource);
      tag = `v${pkg.version}`;
    }
  }

  ensure(tag, 'A release tag must be provided via --tag, --version, or package.json');
  await runRemoteCheck({ owner, repo, tag, skipHttp });
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
    if (error.cause) {
      console.error(error.cause);
    }
  } else {
    console.error(error);
  }
  process.exit(1);
});
