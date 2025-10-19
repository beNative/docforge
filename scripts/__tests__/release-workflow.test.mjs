import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import YAML from 'yaml';
import { analyseMetadataEntry, runRemoteCheck } from '../test-auto-update.mjs';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));

function repoPath(...segments) {
  return path.resolve(REPO_ROOT, '..', '..', ...segments);
}

async function createTemporaryWorkspace(t) {
  const prefix = path.join(repoPath(), `.tmp-release-${process.pid}-`);
  const dir = await fs.mkdtemp(prefix);
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });
  return dir;
}

async function writeFixtureInstaller(directory, version, options = {}) {
  const {
    artifactDir = 'docforge-windows-x64',
    assetName = `DocForge Setup ${version}.exe`,
    metadataFileName = 'latest.yml',
    includeMetadata = true,
    additionalMetadata = [],
    assetSize = 1024,
    includeBlockmap = false,
  } = options;

  const releaseDir = path.join(directory, 'release-artifacts', artifactDir, 'release');
  await fs.mkdir(releaseDir, { recursive: true });

  const installerPath = path.join(releaseDir, assetName);
  const binary = crypto.randomBytes(assetSize);
  await fs.writeFile(installerPath, binary);

  let blockmapPath = null;
  if (includeBlockmap) {
    blockmapPath = `${installerPath}.blockmap`;
    await fs.writeFile(blockmapPath, crypto.randomBytes(Math.max(256, Math.floor(assetSize / 4))));
  }

  let metadataPath = null;
  if (includeMetadata && metadataFileName) {
    const metadata = {
      version,
      files: [
        {
          url: assetName,
          sha512: 'placeholder',
          size: 0,
        },
      ],
      path: assetName,
      sha512: 'placeholder',
      releaseDate: new Date().toISOString(),
    };
    metadataPath = path.join(releaseDir, metadataFileName);
    await fs.writeFile(metadataPath, YAML.stringify(metadata), 'utf8');
  }

  for (const entry of additionalMetadata) {
    const targetPath = path.join(releaseDir, entry.relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const source = entry.source
      ? entry.source
      : YAML.stringify(
          entry.data ?? {
            version,
            files: [],
            path: entry.path ?? assetName,
            sha512: 'placeholder',
          },
        );
    await fs.writeFile(targetPath, source, 'utf8');
  }

  return {
    releaseDir,
    metadataPath,
    artifactDir,
    assetPath: installerPath,
    assetName,
    blockmapPath,
  };
}

async function listMetadataDirectories(rootDirectory) {
  const directories = new Set();

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.yml') || entry.name === 'builder-debug.yml') {
        continue;
      }

      directories.add(path.dirname(fullPath));
    }
  }

  await walk(rootDirectory);
  return Array.from(directories).sort();
}

async function runGenerateReleaseNotes({
  workspace,
  version,
  tag,
  changelogPath,
  outputPath,
  filesOutputPath,
}) {
  const env = {
    ...process.env,
    GITHUB_REPOSITORY: 'beNative/docforge',
  };

  await execFileAsync(
    'node',
    [
      repoPath('scripts', 'generate-release-notes.mjs'),
      '--tag',
      tag,
      '--version',
      version,
      '--artifact-root',
      path.join(workspace, 'release-artifacts'),
      '--changelog',
      changelogPath,
      '--output',
      outputPath,
      '--files-output',
      filesOutputPath,
    ],
    {
      cwd: repoPath(),
      env,
    },
  );
}

async function runLocalVerification(directory, extraArgs = []) {
  await execFileAsync(
    'node',
    [repoPath('scripts', 'test-auto-update.mjs'), '--local', directory, ...extraArgs],
    {
      cwd: repoPath(),
    },
  );
}

function readManifestEntries(manifestSource) {
  return manifestSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function computeSha512Base64(buffer) {
  const hash = crypto.createHash('sha512');
  hash.update(buffer);
  return hash.digest('base64');
}

test('release tooling rewrites metadata and keeps latest.yml published', async (t) => {
  const workspace = await createTemporaryWorkspace(t);
  const { releaseDir, metadataPath: latestPath } = await writeFixtureInstaller(workspace, '0.0.1');

  const changelogPath = path.join(workspace, 'CHANGELOG.md');
  await fs.writeFile(
    changelogPath,
    ['## v0.0.1', '', '- Test release entry for automated validation.'].join('\n'),
    'utf8',
  );

  const notesPath = path.join(workspace, 'release-notes.md');
  const manifestPath = path.join(workspace, 'release-files.txt');

  await runGenerateReleaseNotes({
    workspace,
    version: '0.0.1',
    tag: 'v0.0.1',
    changelogPath,
    outputPath: notesPath,
    filesOutputPath: manifestPath,
  });

  const renamedInstaller = path.join(releaseDir, 'DocForge-Setup-0.0.1.exe');
  await assert.doesNotReject(() => fs.access(renamedInstaller));

  const manifest = await fs.readFile(manifestPath, 'utf8');
  const entries = readManifestEntries(manifest);
  const relativeInstaller = path.relative(repoPath(), renamedInstaller);
  const relativeLatest = path.relative(repoPath(), latestPath);
  const relativeWinChannel = path.relative(
    repoPath(),
    path.join(releaseDir, 'win32-x64.yml'),
  );

  assert(entries.includes(relativeInstaller), 'Installer should be present in manifest after renaming');
  assert(entries.includes(relativeLatest), 'latest.yml must be uploaded as part of the release');
  assert(
    entries.includes(relativeWinChannel),
    'win32-x64.yml must be uploaded for architecture-specific Windows updates',
  );

  const installerBuffer = await fs.readFile(renamedInstaller);
  const expectedSha = computeSha512Base64(installerBuffer);

  const metadata = YAML.parse(await fs.readFile(latestPath, 'utf8'));
  assert.equal(metadata.path, 'DocForge-Setup-0.0.1.exe');
  assert.equal(metadata.sha512, expectedSha);
  if (Object.prototype.hasOwnProperty.call(metadata, 'size')) {
    assert.equal(metadata.size, installerBuffer.length);
  }
  assert(Array.isArray(metadata.files) && metadata.files.length === 1);
  assert.equal(metadata.files[0].url, 'DocForge-Setup-0.0.1.exe');
  assert.equal(metadata.files[0].sha512, expectedSha);
  assert.equal(metadata.files[0].size, installerBuffer.length);

  await runLocalVerification(releaseDir);
});

test('release tooling ignores unpacked directories when enforcing metadata', async (t) => {
  const workspace = await createTemporaryWorkspace(t);
  await writeFixtureInstaller(workspace, '0.0.2', {
    artifactDir: 'docforge-windows-x64',
  });

  const unpackedDir = path.join(
    workspace,
    'release-artifacts',
    'docforge-windows-x64',
    'win-unpacked',
  );
  await fs.mkdir(unpackedDir, { recursive: true });
  const unpackedExecutable = path.join(unpackedDir, 'DocForge.exe');
  await fs.writeFile(unpackedExecutable, crypto.randomBytes(2048));

  const changelogPath = path.join(workspace, 'CHANGELOG.md');
  await fs.writeFile(
    changelogPath,
    ['## v0.0.2', '', '- Ignore unpacked executable fixtures.'].join('\n'),
    'utf8',
  );

  const notesPath = path.join(workspace, 'release-notes.md');
  const manifestPath = path.join(workspace, 'release-files.txt');

  await runGenerateReleaseNotes({
    workspace,
    version: '0.0.2',
    tag: 'v0.0.2',
    changelogPath,
    outputPath: notesPath,
    filesOutputPath: manifestPath,
  });

  const manifest = await fs.readFile(manifestPath, 'utf8');
  const entries = readManifestEntries(manifest);
  assert(entries.every((line) => !line.includes('DocForge.exe')));
});

test('local verification can repair mismatched metadata when requested', async (t) => {
  const workspace = await createTemporaryWorkspace(t);
  const version = '0.0.2';
  const { releaseDir, metadataPath, assetPath } = await writeFixtureInstaller(workspace, version, {
    assetSize: 2048,
  });

  const corrupted = YAML.parse(await fs.readFile(metadataPath, 'utf8'));
  corrupted.sha512 = 'invalid-sha512';
  corrupted.files[0].sha512 = 'invalid-sha512';
  corrupted.files[0].size = 1;
  await fs.writeFile(metadataPath, YAML.stringify(corrupted), 'utf8');

  await assert.rejects(() => runLocalVerification(releaseDir), /Local auto-update verification failed/);

  await runLocalVerification(releaseDir, ['--fix-metadata']);

  const installerBuffer = await fs.readFile(assetPath);
  const expectedSha = computeSha512Base64(installerBuffer);
  const updated = YAML.parse(await fs.readFile(metadataPath, 'utf8'));

  assert.equal(updated.path, path.basename(assetPath));
  assert.equal(updated.sha512, expectedSha);
  if (Object.prototype.hasOwnProperty.call(updated, 'size')) {
    assert.equal(updated.size, installerBuffer.length);
  }
  assert(Array.isArray(updated.files) && updated.files.length === 1);
  assert.equal(updated.files[0].url, path.basename(assetPath));
  assert.equal(updated.files[0].sha512, expectedSha);
  assert.equal(updated.files[0].size, installerBuffer.length);
});

test('metadata updates remain isolated across artifact directories with identical installer names', async (t) => {
  const workspace = await createTemporaryWorkspace(t);
  const version = '0.0.3';
  const x64 = await writeFixtureInstaller(workspace, version, {
    artifactDir: 'docforge-windows-x64',
    includeBlockmap: true,
  });
  const arm64 = await writeFixtureInstaller(workspace, version, {
    artifactDir: 'docforge-windows-arm64',
    includeBlockmap: true,
  });

  const changelogPath = path.join(workspace, 'CHANGELOG.md');
  await fs.writeFile(
    changelogPath,
    [`## v${version}`, '', '- Test release entry for duplicate installer validation.'].join('\n'),
    'utf8',
  );

  const notesPath = path.join(workspace, 'release-notes.md');
  const manifestPath = path.join(workspace, 'release-files.txt');

  await runGenerateReleaseNotes({
    workspace,
    version,
    tag: `v${version}`,
    changelogPath,
    outputPath: notesPath,
    filesOutputPath: manifestPath,
  });

  const renamedX64Name = `DocForge-Setup-${version}.exe`;
  const renamedArm64Name = `DocForge-Setup-${version}-arm64.exe`;
  const renamedX64 = path.join(x64.releaseDir, renamedX64Name);
  const renamedArm64 = path.join(arm64.releaseDir, renamedArm64Name);

  await Promise.all([
    assert.doesNotReject(() => fs.access(renamedX64)),
    assert.doesNotReject(() => fs.access(renamedArm64)),
    assert.doesNotReject(() => fs.access(path.join(x64.releaseDir, `${renamedX64Name}.blockmap`))),
    assert.doesNotReject(() => fs.access(path.join(arm64.releaseDir, `${renamedArm64Name}.blockmap`))),
  ]);

  const [x64Buffer, arm64Buffer] = await Promise.all([
    fs.readFile(renamedX64),
    fs.readFile(renamedArm64),
  ]);

  const [x64Metadata, arm64Metadata] = await Promise.all([
    fs.readFile(x64.metadataPath, 'utf8').then((source) => YAML.parse(source)),
    fs.readFile(arm64.metadataPath, 'utf8').then((source) => YAML.parse(source)),
  ]);

  const x64Sha = computeSha512Base64(x64Buffer);
  const arm64Sha = computeSha512Base64(arm64Buffer);

  assert.notEqual(x64Sha, arm64Sha, 'installer binaries should differ between architectures');

  const manifest = await fs.readFile(manifestPath, 'utf8');
  const entries = readManifestEntries(manifest);
  const expectedX64Entry = path.relative(repoPath(), renamedX64);
  const expectedArm64Entry = path.relative(repoPath(), renamedArm64);
  assert(entries.includes(expectedX64Entry), 'x64 installer should be listed in manifest');
  assert(entries.includes(expectedArm64Entry), 'arm64 installer should be listed in manifest');

  const assertMetadataMatches = (metadata, expectedName, expectedSha, bufferLength) => {
    assert.equal(metadata.path, expectedName);
    assert.equal(metadata.sha512, expectedSha);
    if (Object.prototype.hasOwnProperty.call(metadata, 'size')) {
      assert.equal(metadata.size, bufferLength);
    }
    assert(Array.isArray(metadata.files) && metadata.files.length === 1);
    assert.equal(metadata.files[0].url, expectedName);
    assert.equal(metadata.files[0].sha512, expectedSha);
    assert.equal(metadata.files[0].size, bufferLength);
  };

  assertMetadataMatches(x64Metadata, renamedX64Name, x64Sha, x64Buffer.length);
  assertMetadataMatches(arm64Metadata, renamedArm64Name, arm64Sha, arm64Buffer.length);

  await Promise.all([
    runLocalVerification(x64.releaseDir),
    runLocalVerification(arm64.releaseDir),
  ]);
});

test('release workflow verifies metadata directories across platforms and publishes manifests', async (t) => {
  const workspace = await createTemporaryWorkspace(t);
  const version = '0.0.5';

  const ia32 = await writeFixtureInstaller(workspace, version, {
    artifactDir: 'docforge-windows-ia32',
    includeBlockmap: true,
    additionalMetadata: [
      {
        relativePath: path.join('win-ia32-unpacked', 'resources', 'app-update.yml'),
        data: {
          version,
          files: [],
        },
      },
    ],
  });

  const x64 = await writeFixtureInstaller(workspace, version, {
    artifactDir: 'docforge-windows-x64',
    includeBlockmap: true,
  });

  const linux = await writeFixtureInstaller(workspace, version, {
    artifactDir: 'docforge-linux-arm64',
    assetName: `DocForge-${version}-arm64.AppImage`,
    metadataFileName: 'latest-linux-arm64.yml',
  });

  const mac = await writeFixtureInstaller(workspace, version, {
    artifactDir: 'docforge-macos-x64',
    assetName: `DocForge-${version}.dmg`,
    metadataFileName: 'latest-mac.yml',
  });

  const changelogPath = path.join(workspace, 'CHANGELOG.md');
  await fs.writeFile(
    changelogPath,
    [`## v${version}`, '', '- Test entry for multi-platform metadata verification.'].join('\n'),
    'utf8',
  );

  const notesPath = path.join(workspace, 'release-notes.md');
  const manifestPath = path.join(workspace, 'release-files.txt');

  await runGenerateReleaseNotes({
    workspace,
    version,
    tag: `v${version}`,
    changelogPath,
    outputPath: notesPath,
    filesOutputPath: manifestPath,
  });

  const manifestEntries = new Set(readManifestEntries(await fs.readFile(manifestPath, 'utf8')));
  const publishedNames = new Map();
  for (const entry of manifestEntries) {
    const [relativePath, explicitName] = entry.split('#');
    const candidateName = explicitName || path.basename(relativePath);
    const previousEntry = publishedNames.get(candidateName);
    assert(
      !previousEntry,
      `Duplicate release asset name detected: ${candidateName} (entries: ${previousEntry}, ${entry})`,
    );
    publishedNames.set(candidateName, entry);
  }
  const appUpdateRelative = path.relative(
    repoPath(),
    path.join(ia32.releaseDir, 'win-ia32-unpacked', 'resources', 'app-update.yml'),
  );
  assert(
    !manifestEntries.has(appUpdateRelative),
    'app-update.yml should not be uploaded to the release',
  );
  const ia32InstallerName = `DocForge-Setup-${version}-ia32.exe`;
  const x64InstallerName = `DocForge-Setup-${version}.exe`;
  const expectedWindowsBinaries = [
    path.relative(repoPath(), path.join(ia32.releaseDir, ia32InstallerName)),
    path.relative(repoPath(), path.join(x64.releaseDir, x64InstallerName)),
  ];
  for (const entry of expectedWindowsBinaries) {
    assert(manifestEntries.has(entry), `${entry} must be included for Windows release assets`);
  }

  const expectedBlockmaps = [
    path.relative(repoPath(), path.join(ia32.releaseDir, `${ia32InstallerName}.blockmap`)),
    path.relative(repoPath(), path.join(x64.releaseDir, `${x64InstallerName}.blockmap`)),
  ];
  for (const blockmap of expectedBlockmaps) {
    assert(manifestEntries.has(blockmap), `${blockmap} must be published after renaming installers`);
  }

  const expectedMetadataUploads = [x64.metadataPath, linux.metadataPath, mac.metadataPath];
  for (const metadataPath of expectedMetadataUploads) {
    assert(metadataPath, 'metadataPath should be defined for uploaded manifests');
    const relativePath = path.relative(repoPath(), metadataPath);
    assert(manifestEntries.has(relativePath), `${relativePath} must be included in release manifest`);
  }

  const ia32LatestRelative = path.relative(repoPath(), ia32.metadataPath);
  assert(
    !manifestEntries.has(ia32LatestRelative),
    'Windows ia32 latest.yml should be replaced by architecture-specific manifest to avoid duplicate assets',
  );

  const windowsChannels = [
    path.relative(repoPath(), path.join(ia32.releaseDir, 'win32-ia32.yml')),
    path.relative(repoPath(), path.join(x64.releaseDir, 'win32-x64.yml')),
  ];
  for (const channel of windowsChannels) {
    assert(manifestEntries.has(channel), `${channel} must be uploaded for Windows auto-update`);
  }

  const metadataDirs = await listMetadataDirectories(path.join(workspace, 'release-artifacts'));
  const expectedDirs = [ia32.metadataPath, x64.metadataPath, linux.metadataPath, mac.metadataPath]
    .filter(Boolean)
    .map((metadataPath) => path.dirname(metadataPath));
  for (const expectedDir of expectedDirs) {
    assert(
      metadataDirs.includes(expectedDir),
      `${expectedDir} should be discovered for metadata verification`,
    );
  }

  for (const dir of metadataDirs) {
    await runLocalVerification(dir);
  }
});

test('release generation fails when required latest metadata is missing', async (t) => {
  const workspace = await createTemporaryWorkspace(t);
  const version = '0.0.7';
  await writeFixtureInstaller(workspace, version, {
    artifactDir: 'docforge-windows-ia32',
    includeMetadata: false,
  });

  const changelogPath = path.join(workspace, 'CHANGELOG.md');
  await fs.writeFile(
    changelogPath,
    [`## v${version}`, '', '- Test entry for missing metadata detection.'].join('\n'),
    'utf8',
  );

  const notesPath = path.join(workspace, 'release-notes.md');
  const manifestPath = path.join(workspace, 'release-files.txt');

  await assert.rejects(
    () =>
      runGenerateReleaseNotes({
        workspace,
        version,
        tag: `v${version}`,
        changelogPath,
        outputPath: notesPath,
        filesOutputPath: manifestPath,
      }),
    /Missing required auto-update metadata/,
  );
});

test('remote auto-update check fails when Windows release metadata is absent', async () => {
  await assert.rejects(
    () =>
      runRemoteCheck({
        owner: 'beNative',
        repo: 'docforge',
        tag: 'v0.6.7',
        skipHttp: true,
        skipDownload: true,
        http: {
          fetchJson: async () => ({
            assets: [
              {
                name: 'DocForge-Setup-0.6.7.exe',
                browser_download_url: 'https://example.invalid/DocForge-Setup-0.6.7.exe',
              },
            ],
          }),
        },
      }),
    (error) => {
      assert(error instanceof Error, 'Expected runRemoteCheck to reject with an Error instance');
      assert.match(
        error.message,
        /Missing required auto-update metadata asset[\s\S]*latest\.yml[\s\S]*win32-<arch>\.yml/,
        'Error message should mention both legacy and architecture-specific manifests',
      );
      return true;
    },
  );
});

test('auto-update analysis reports unreachable assets when GitHub returns 404', async () => {
  const metadataSource = YAML.stringify({
    version: '0.6.7',
    files: [
      {
        url: 'DocForge-Setup-0.6.7.exe',
        sha512: 'placeholder',
        size: 100,
      },
    ],
    path: 'DocForge-Setup-0.6.7.exe',
    sha512: 'placeholder',
  });

  const assets = new Map([
    [
      'DocForge-Setup-0.6.7.exe',
      {
        name: 'DocForge-Setup-0.6.7.exe',
        browser_download_url: 'https://example.invalid/DocForge-Setup-0.6.7.exe',
      },
    ],
  ]);

  const result = await analyseMetadataEntry({
    metadataName: 'latest.yml',
    metadataSource,
    owner: 'beNative',
    repo: 'docforge',
    tag: 'v0.6.7',
    assets,
    skipHttp: false,
    skipDownload: true,
    digestCache: new Map(),
    http: {
      headRequest: async () => ({ ok: false, status: 404, error: new Error('Not Found') }),
    },
  });

  assert(result.unreachable.some((entry) => entry.includes('DocForge-Setup-0.6.7.exe') && entry.includes('404 (Not Found)')));
});

test('metadata updates compute digests for non-release assets referenced locally', async (t) => {
  const workspace = await createTemporaryWorkspace(t);
  const version = '0.0.4';
  const { releaseDir } = await writeFixtureInstaller(workspace, version);

  const nupkgName = `DocForge-${version}-full.nupkg`;
  const nupkgPath = path.join(releaseDir, nupkgName);
  const nupkgBuffer = crypto.randomBytes(2048);
  await fs.writeFile(nupkgPath, nupkgBuffer);

  const metadataPath = path.join(releaseDir, 'nupkg.yml');
  const initialMetadata = {
    files: [
      {
        url: nupkgName,
        sha512: 'placeholder',
        size: 0,
      },
    ],
    path: nupkgName,
    sha512: 'placeholder',
  };
  await fs.writeFile(metadataPath, YAML.stringify(initialMetadata), 'utf8');

  const changelogPath = path.join(workspace, 'CHANGELOG.md');
  await fs.writeFile(
    changelogPath,
    [`## v${version}`, '', '- Non-release asset metadata validation.'].join('\n'),
    'utf8',
  );

  const notesPath = path.join(workspace, 'release-notes.md');
  const manifestPath = path.join(workspace, 'release-files.txt');

  await runGenerateReleaseNotes({
    workspace,
    version,
    tag: `v${version}`,
    changelogPath,
    outputPath: notesPath,
    filesOutputPath: manifestPath,
  });

  const metadata = YAML.parse(await fs.readFile(metadataPath, 'utf8'));
  const expectedSha = computeSha512Base64(nupkgBuffer);

  assert.equal(metadata.path, nupkgName);
  assert.equal(metadata.sha512, expectedSha);
  assert(Array.isArray(metadata.files) && metadata.files.length === 1);
  assert.equal(metadata.files[0].url, nupkgName);
  assert.equal(metadata.files[0].sha512, expectedSha);
  assert.equal(metadata.files[0].size, nupkgBuffer.length);

  await runLocalVerification(releaseDir);
});

test('local auto-update verification fails when metadata assets are missing', async (t) => {
  const workspace = await createTemporaryWorkspace(t);
  const { releaseDir, metadataPath: latestPath } = await writeFixtureInstaller(workspace, '0.0.2');

  await fs.rm(latestPath);

  await assert.rejects(
    () => runLocalVerification(releaseDir),
    /No metadata files were found/,
  );
});

