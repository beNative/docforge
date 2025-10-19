#!/usr/bin/env node
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { execFile, spawn } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import process from 'process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const DEFAULT_OWNER = 'beNative';
const DEFAULT_REPO = 'docforge';

export function parseArgs(argv) {
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

export function normaliseInstallerFileName(fileName) {
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

export function extractMetadataReferences(source) {
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

export function extractMetadataTargets(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }
  const targets = new Map();
  const record = (name, label, entry = {}) => {
    if (!name) {
      return;
    }
    const normalised = name.trim();
    if (!normalised) {
      return;
    }
    const current = targets.get(normalised) ?? { name: normalised, contexts: [] };
    const expectedSha512 = typeof entry.sha512 === 'string' ? entry.sha512.trim() || null : null;
    const expectedSize = typeof entry.size === 'number' ? entry.size : null;
    current.contexts.push({ label, expectedSha512, expectedSize });
    targets.set(normalised, current);
  };

  if (Array.isArray(metadata.files)) {
    metadata.files.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      record(entry.url || entry.path, `files[${index}]`, entry);
    });
  }

  if (typeof metadata.path === 'string' && metadata.path.trim()) {
    record(metadata.path, 'path', {
      sha512: metadata.sha512,
      size: typeof metadata.size === 'number' ? metadata.size : null,
    });
  }

  return Array.from(targets.values());
}

const directoryListingCache = new Map();

async function listDirectoryEntries(directory) {
  let cached = directoryListingCache.get(directory);
  if (cached) {
    return cached;
  }

  try {
    const entries = await fs.readdir(directory);
    cached = entries.map((name) => ({
      name,
      normalised: normaliseInstallerFileName(name),
    }));
  } catch {
    cached = [];
  }

  directoryListingCache.set(directory, cached);
  return cached;
}

async function resolveLocalAsset(metadataDir, key, digestCache) {
  if (!key || typeof key !== 'string') {
    return null;
  }

  const candidates = [];
  const seen = new Set();

  const addCandidate = (value) => {
    if (!value || typeof value !== 'string') {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  addCandidate(key);
  const normalised = normaliseInstallerFileName(key);
  if (normalised && normalised !== key) {
    addCandidate(normalised);
  }

  const lowerKey = key.toLowerCase();
  const normalisedLower = normalised.toLowerCase();
  const suffixPatterns = ['.exe.blockmap', '.exe'];
  let directoryEntries = null;
  for (const suffix of suffixPatterns) {
    if (!lowerKey.endsWith(suffix) && !normalisedLower.endsWith(suffix)) {
      continue;
    }

    if (!directoryEntries) {
      directoryEntries = await listDirectoryEntries(metadataDir);
    }

    const baseCandidates = new Set([
      lowerKey.endsWith(suffix) ? lowerKey.slice(0, -suffix.length) : null,
      normalisedLower.endsWith(suffix) ? normalisedLower.slice(0, -suffix.length) : null,
    ].filter(Boolean));

    for (const entry of directoryEntries) {
      const entryName = entry.name;
      const entryLower = entryName.toLowerCase();
      const entryNormalisedLower = entry.normalised.toLowerCase();
      if (
        !entryLower.endsWith(suffix) &&
        !entryNormalisedLower.endsWith(suffix)
      ) {
        continue;
      }

      const normalisedEntryForSuffix = entryNormalisedLower.endsWith(suffix)
        ? entry.normalised.toLowerCase()
        : entryLower;
      const entryBaseLower = normalisedEntryForSuffix.slice(0, -suffix.length);
      for (const base of baseCandidates) {
        if (!base) {
          continue;
        }
        if (entryBaseLower === base || entryBaseLower.startsWith(`${base}-`)) {
          addCandidate(entryName);
          break;
        }
      }
    }
  }

  for (const candidate of candidates) {
    const candidatePath = path.resolve(metadataDir, candidate);
    const relative = path.relative(metadataDir, candidatePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      continue;
    }

    try {
      const stats = await fs.stat(candidatePath);
      if (!stats.isFile()) {
        continue;
      }

      let digest = digestCache.get(candidatePath);
      if (!digest) {
        digest = await computeLocalDigest(candidatePath);
        digestCache.set(candidatePath, digest);
      }

      return {
        name: candidate,
        path: candidatePath,
        sha512: digest.sha512,
        size: digest.size,
      };
    } catch {
      // Ignore missing assets at this stage; verification will surface the issue.
    }
  }

  return null;
}

async function repairLocalMetadataFile(metadataPath, metadataDocument) {
  if (!metadataDocument || typeof metadataDocument !== 'object') {
    return false;
  }

  const metadataDir = path.dirname(metadataPath);
  const digestCache = new Map();
  let changed = false;

  const ensureEntryMatchesAsset = async (entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const key = entry.url || entry.path;
    const asset = await resolveLocalAsset(metadataDir, key, digestCache);
    if (!asset) {
      return false;
    }

    let localChange = false;
    if (entry.url && entry.url !== asset.name) {
      entry.url = asset.name;
      localChange = true;
    }
    if (entry.path && entry.path !== asset.name) {
      entry.path = asset.name;
      localChange = true;
    }
    if (asset.sha512 && entry.sha512 !== asset.sha512) {
      entry.sha512 = asset.sha512;
      localChange = true;
    }
    if (typeof asset.size === 'number' && entry.size !== asset.size) {
      entry.size = asset.size;
      localChange = true;
    }
    return localChange;
  };

  if (Array.isArray(metadataDocument.files)) {
    for (const entry of metadataDocument.files) {
      if (await ensureEntryMatchesAsset(entry)) {
        changed = true;
      }
    }
  }

  const primarySource =
    (typeof metadataDocument.path === 'string' && metadataDocument.path.trim()) ||
    (Array.isArray(metadataDocument.files) &&
      metadataDocument.files[0] &&
      (metadataDocument.files[0].path || metadataDocument.files[0].url));

  const primaryAsset = await resolveLocalAsset(metadataDir, primarySource, digestCache);
  if (primaryAsset) {
    if (metadataDocument.path !== primaryAsset.name) {
      metadataDocument.path = primaryAsset.name;
      changed = true;
    }
    if (metadataDocument.sha512 !== primaryAsset.sha512) {
      metadataDocument.sha512 = primaryAsset.sha512;
      changed = true;
    }
    if (typeof primaryAsset.size === 'number' && metadataDocument.size !== primaryAsset.size) {
      metadataDocument.size = primaryAsset.size;
      changed = true;
    }

    if (!Array.isArray(metadataDocument.files) || metadataDocument.files.length === 0) {
      metadataDocument.files = [
        {
          url: primaryAsset.name,
          sha512: primaryAsset.sha512,
          size: primaryAsset.size,
        },
      ];
      changed = true;
    }
  }

  if (Array.isArray(metadataDocument.files)) {
    for (const entry of metadataDocument.files) {
      if (await ensureEntryMatchesAsset(entry)) {
        changed = true;
      }
    }
  }

  if (changed) {
    const serialised = YAML.stringify(metadataDocument, { lineWidth: 0 }).trimEnd();
    await fs.writeFile(metadataPath, `${serialised}\n`, 'utf8');
  }

  return changed;
}

const execFileAsync = promisify(execFile);

export async function curlGet(url, headers) {
  const args = ['-sS', '-L', '--fail-with-body'];
  for (const [key, value] of Object.entries(headers)) {
    args.push('-H', `${key}: ${value}`);
  }
  args.push(url);
  const { stdout } = await execFileAsync('curl', args);
  return stdout;
}

export async function curlHead(url, headers) {
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

export async function fetchJson(url, headers) {
  const body = await curlGet(url, headers);
  return JSON.parse(body);
}

export async function fetchText(url, headers) {
  return curlGet(url, headers);
}

export async function headRequest(url, headers) {
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

async function computeLocalDigest(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const stream = createReadStream(filePath);
    let size = 0;
    stream.on('data', (chunk) => {
      hash.update(chunk);
      size += chunk.length;
    });
    stream.on('error', reject);
    stream.on('end', () => {
      resolve({ sha512: hash.digest('base64'), size });
    });
  });
}

function downloadAndComputeDigest(url, headers) {
  return new Promise((resolve, reject) => {
    const args = ['-sS', '-L', '--fail'];
    for (const [key, value] of Object.entries(headers)) {
      args.push('-H', `${key}: ${value}`);
    }
    args.push(url);

    const child = spawn('curl', args);
    const hash = crypto.createHash('sha512');
    let size = 0;
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      hash.update(chunk);
      size += chunk.length;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `curl exited with code ${code}`));
        return;
      }
      resolve({ sha512: hash.digest('base64'), size });
    });
  });
}

export async function analyseMetadataEntry({
  metadataName,
  metadataSource,
  owner,
  repo,
  tag,
  assets,
  skipHttp,
  skipDownload,
  digestCache,
  http,
}) {
  const headRequestFn = http?.headRequest ?? headRequest;
  const references = extractMetadataReferences(metadataSource);
  const missing = [];
  const unreachable = [];
  const suggestions = [];
  const mismatchedHashes = [];
  const missingHashes = [];
  const mismatchedSizes = [];
  let parseError = null;
  let metadataDocument = null;

  try {
    metadataDocument = YAML.parse(metadataSource);
  } catch (error) {
    parseError = error instanceof Error ? error : new Error(String(error));
  }

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
      const { ok, status, error } = await headRequestFn(downloadUrl, {
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

  if (parseError) {
    console.log(`  ✗ Failed to parse metadata: ${parseError.message}`);
    return { missing, unreachable, mismatchedHashes, missingHashes, mismatchedSizes, parseError };
  }

  if (!metadataDocument || typeof metadataDocument !== 'object') {
    console.log('  ✗ Metadata did not contain a valid YAML object.');
    return { missing, unreachable, mismatchedHashes, missingHashes, mismatchedSizes, parseError: new Error('invalid-metadata') };
  }

  const targets = extractMetadataTargets(metadataDocument);
  if (targets.length === 0) {
    console.log('  • No asset references were found after parsing the metadata; skipping checksum verification.');
    return { missing, unreachable, mismatchedHashes, missingHashes, mismatchedSizes };
  }

  const downloadHeaders = {
    'User-Agent': 'docforge-auto-update-tester',
    Accept: 'application/octet-stream',
  };

  for (const target of targets) {
    const asset = assets.get(target.name);
    if (!asset) {
      continue;
    }

    let digest = digestCache.get(target.name) ?? null;
    if (!digest && !skipDownload) {
      try {
        digest = await downloadAndComputeDigest(asset.browser_download_url, downloadHeaders);
        digestCache.set(target.name, digest);
      } catch (error) {
        mismatchedHashes.push(`${target.name} - failed to download for verification (${error instanceof Error ? error.message : error})`);
        continue;
      }
    }

    for (const context of target.contexts) {
      if (!context.expectedSha512) {
        missingHashes.push(`${target.name} (${context.label}) - missing sha512 in metadata`);
      } else if (digest && context.expectedSha512 !== digest.sha512) {
        mismatchedHashes.push(`${target.name} (${context.label}) - expected ${context.expectedSha512} got ${digest.sha512}`);
      }

      if (typeof context.expectedSize === 'number') {
        if (digest && context.expectedSize !== digest.size) {
          mismatchedSizes.push(`${target.name} (${context.label}) - expected size ${context.expectedSize} got ${digest.size}`);
        }
      }
    }
  }

  if (!skipDownload && mismatchedHashes.length === 0 && missingHashes.length === 0) {
    console.log('  ✓ All referenced asset checksums match the published files.');
  } else if (skipDownload && missingHashes.length === 0) {
    console.log('  ✓ Metadata includes sha512 values for all referenced assets.');
  }

  if (mismatchedHashes.length > 0) {
    console.log('  ✗ SHA512 mismatches detected:');
    reportIssue('', mismatchedHashes);
  }

  if (missingHashes.length > 0) {
    console.log('  ✗ Missing SHA512 entries:');
    reportIssue('', missingHashes);
  }

  if (mismatchedSizes.length > 0) {
    console.log('  ✗ Size mismatches detected:');
    reportIssue('', mismatchedSizes);
  }

  return { missing, unreachable, mismatchedHashes, missingHashes, mismatchedSizes };
}

function describeMissingMetadataAssets(assetEntries, metadataAssets) {
  const missing = [];
  const windowsInstallers = assetEntries.filter((asset) => asset.name.endsWith('.exe'));

  if (windowsInstallers.length === 0) {
    return missing;
  }

  const installerList = windowsInstallers.map((asset) => asset.name).join(', ');
  const hasLatest = metadataAssets.some((asset) => asset.name === 'latest.yml');
  const hasWindowsChannel = metadataAssets.some(
    (asset) => asset.name.startsWith('win32-') && asset.name.endsWith('.yml'),
  );

  if (!hasLatest) {
    missing.push(
      [
        'latest.yml (required for legacy Windows auto-update clients)',
        installerList ? `Windows installers detected: ${installerList}` : null,
      ]
        .filter(Boolean)
        .join(' - '),
    );
  }

  if (!hasWindowsChannel) {
    missing.push(
      [
        'win32-<arch>.yml (required for architecture-specific Windows auto-update channels)',
        installerList ? `Windows installers detected: ${installerList}` : null,
      ]
        .filter(Boolean)
        .join(' - '),
    );
  }

  return missing;
}

const defaultHttp = {
  fetchJson,
  fetchText,
  headRequest,
};

export async function runRemoteCheck({ owner, repo, tag, skipHttp, skipDownload, http = defaultHttp }) {
  const headers = {
    'User-Agent': 'docforge-auto-update-tester',
    Accept: 'application/vnd.github+json',
  };
  const fetchJsonFn = http.fetchJson ?? fetchJson;
  const fetchTextFn = http.fetchText ?? fetchText;
  const headRequestFn = http.headRequest ?? headRequest;

  const release = await fetchJsonFn(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`, headers);
  const assetEntries = release.assets ?? [];
  if (assetEntries.length === 0) {
    throw new Error(`No assets found for ${owner}/${repo} ${tag}.`);
  }

  const assetMap = new Map(assetEntries.map((asset) => [asset.name, asset]));
  const metadataAssets = assetEntries.filter((asset) => asset.name.endsWith('.yml') && asset.name !== 'builder-debug.yml');
  const missingRequired = describeMissingMetadataAssets(assetEntries, metadataAssets);
  if (metadataAssets.length === 0) {
    const details = missingRequired.length > 0 ? `\n${missingRequired.map((entry) => ` - ${entry}`).join('\n')}` : '';
    throw new Error(
      [
        'No update metadata (.yml) files were found in the release.',
        details && 'Missing required auto-update metadata asset(s):',
        details,
        'Ensure the release upload step includes the generated auto-update manifests.',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  if (missingRequired.length > 0) {
    throw new Error(
      [
        'Missing required auto-update metadata asset:',
        ...missingRequired.map((entry) => ` - ${entry}`),
        'Electron auto-update downloads latest.yml from the release. Upload the manifest alongside the installer.',
      ].join('\n'),
    );
  }

  console.log(`Auto-update asset verification for ${owner}/${repo} ${tag}`);
  console.log(`Found ${assetEntries.length} total assets and ${metadataAssets.length} metadata files.`);

  let failures = false;
  const digestCache = new Map();
  for (const asset of metadataAssets) {
    const content = await fetchTextFn(asset.browser_download_url, { 'User-Agent': 'docforge-auto-update-tester' });
    const result = await analyseMetadataEntry({
      metadataName: asset.name,
      metadataSource: content,
      owner,
      repo,
      tag,
      assets: assetMap,
      skipHttp,
      skipDownload,
      digestCache,
      http: { headRequest: headRequestFn },
    });
    if (
      result.missing.length > 0 ||
      result.unreachable.length > 0 ||
      result.mismatchedHashes.length > 0 ||
      result.missingHashes.length > 0 ||
      result.mismatchedSizes.length > 0
    ) {
      failures = true;
    }
  }

  if (failures) {
    throw new Error('Auto-update verification failed. See details above.');
  }

  console.log('\nAll metadata files reference available, reachable assets with matching hashes.');
}

async function runLocalCheck({ directory, skipDownload, fixMetadata = false }) {
  directoryListingCache.clear();
  const resolvedDirectory = path.resolve(directory);
  const entries = await fs.readdir(resolvedDirectory);
  const metadataFiles = entries.filter(
    (entry) => entry.endsWith('.yml') && entry !== 'builder-debug.yml',
  );
  if (metadataFiles.length === 0) {
    throw new Error(`No metadata files were found in ${resolvedDirectory}`);
  }

  console.log(`Auto-update asset verification for local directory ${resolvedDirectory}`);
  console.log(`Found ${metadataFiles.length} metadata file(s).`);

  let failures = false;
  for (const metadataFile of metadataFiles) {
    const metadataPath = path.join(resolvedDirectory, metadataFile);
    let source = await fs.readFile(metadataPath, 'utf8');
    let metadataDocument = null;
    let parseError = null;

    try {
      metadataDocument = YAML.parse(source);
    } catch (error) {
      parseError = error instanceof Error ? error : new Error(String(error));
    }

    let repaired = false;
    if (fixMetadata && !parseError && metadataDocument && typeof metadataDocument === 'object') {
      repaired = await repairLocalMetadataFile(metadataPath, metadataDocument);
      if (repaired) {
        source = await fs.readFile(metadataPath, 'utf8');
        metadataDocument = YAML.parse(source);
      }
    }

    const references = extractMetadataReferences(source);
    const missing = [];
    const mismatchedHashes = [];
    const missingHashes = [];
    const mismatchedSizes = [];

    console.log(`\nMetadata: ${metadataFile}`);
    console.log(`  Referenced files: ${references.length}`);
    if (repaired) {
      console.log('  • Updated metadata checksums to match local assets.');
    }

    for (const reference of references) {
      const targetPath = path.join(resolvedDirectory, reference);
      try {
        await fs.access(targetPath);
      } catch {
        missing.push(reference);
      }
    }

    if (missing.length > 0) {
      failures = true;
      console.log('  ✗ Missing assets:');
      reportIssue('', missing);
    } else {
      console.log('  ✓ All referenced files exist locally.');
    }

    if (parseError) {
      failures = true;
      console.log(`  ✗ Failed to parse metadata: ${parseError.message}`);
      continue;
    }

    if (!metadataDocument || typeof metadataDocument !== 'object') {
      failures = true;
      console.log('  ✗ Metadata did not contain a valid YAML object.');
      continue;
    }

    const targets = extractMetadataTargets(metadataDocument);
    const digestCache = new Map();

    for (const target of targets) {
      const assetPath = path.join(resolvedDirectory, target.name);
      try {
        await fs.access(assetPath);
      } catch {
        continue;
      }

      let digest = digestCache.get(target.name) ?? null;
      if (!digest && !skipDownload) {
        digest = await computeLocalDigest(assetPath);
        digestCache.set(target.name, digest);
      }

      for (const context of target.contexts) {
        if (!context.expectedSha512) {
          missingHashes.push(`${target.name} (${context.label}) - missing sha512 in metadata`);
        } else if (digest && context.expectedSha512 !== digest.sha512) {
          mismatchedHashes.push(`${target.name} (${context.label}) - expected ${context.expectedSha512} got ${digest.sha512}`);
        }

        if (typeof context.expectedSize === 'number') {
          if (digest && context.expectedSize !== digest.size) {
            mismatchedSizes.push(`${target.name} (${context.label}) - expected size ${context.expectedSize} got ${digest.size}`);
          }
        }
      }
    }

    if (!skipDownload && mismatchedHashes.length === 0 && missingHashes.length === 0) {
      console.log('  ✓ All referenced asset checksums match the local files.');
    } else if (skipDownload && missingHashes.length === 0) {
      console.log('  ✓ Metadata includes sha512 values for all referenced assets.');
    }

    if (mismatchedHashes.length > 0) {
      failures = true;
      console.log('  ✗ SHA512 mismatches detected:');
      reportIssue('', mismatchedHashes);
    }

    if (missingHashes.length > 0) {
      failures = true;
      console.log('  ✗ Missing SHA512 entries:');
      reportIssue('', missingHashes);
    }

    if (mismatchedSizes.length > 0) {
      failures = true;
      console.log('  ✗ Size mismatches detected:');
      reportIssue('', mismatchedSizes);
    }
  }

  if (failures) {
    throw new Error('Local auto-update verification failed.');
  }

  console.log('\nAll local metadata files reference existing assets with matching hashes.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const localDir = args.local ?? null;
  const skipHttp = Boolean(args['skip-http']);
  const skipDownload = Boolean(args['skip-download']);
  const fixMetadata = Boolean(args['fix-metadata']);

  if (localDir) {
    await runLocalCheck({ directory: localDir, skipDownload, fixMetadata });
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
  await runRemoteCheck({ owner, repo, tag, skipHttp, skipDownload });
}

const isCliExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliExecution) {
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
}

export { runLocalCheck };
