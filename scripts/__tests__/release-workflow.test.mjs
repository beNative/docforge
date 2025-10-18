import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import YAML from 'yaml';

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
  } = options;

  const releaseDir = path.join(directory, 'release-artifacts', artifactDir, 'release');
  await fs.mkdir(releaseDir, { recursive: true });

  const installerPath = path.join(releaseDir, assetName);
  const binary = crypto.randomBytes(assetSize);
  await fs.writeFile(installerPath, binary);

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

async function runLocalVerification(directory) {
  await execFileAsync(
    'node',
    [repoPath('scripts', 'test-auto-update.mjs'), '--local', directory],
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

  assert(entries.includes(relativeInstaller), 'Installer should be present in manifest after renaming');
  assert(entries.includes(relativeLatest), 'latest.yml must be uploaded as part of the release');

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

test('metadata updates remain isolated across artifact directories with identical installer names', async (t) => {
  const workspace = await createTemporaryWorkspace(t);
  const version = '0.0.3';
  const x64 = await writeFixtureInstaller(workspace, version, { artifactDir: 'docforge-windows-x64' });
  const arm64 = await writeFixtureInstaller(workspace, version, { artifactDir: 'docforge-windows-arm64' });

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

  const renamedInstallerName = `DocForge-Setup-${version}.exe`;
  const renamedX64 = path.join(x64.releaseDir, renamedInstallerName);
  const renamedArm64 = path.join(arm64.releaseDir, renamedInstallerName);

  await Promise.all([
    assert.doesNotReject(() => fs.access(renamedX64)),
    assert.doesNotReject(() => fs.access(renamedArm64)),
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

  const assertMetadataMatches = (metadata, expectedSha, bufferLength) => {
    assert.equal(metadata.path, renamedInstallerName);
    assert.equal(metadata.sha512, expectedSha);
    if (Object.prototype.hasOwnProperty.call(metadata, 'size')) {
      assert.equal(metadata.size, bufferLength);
    }
    assert(Array.isArray(metadata.files) && metadata.files.length === 1);
    assert.equal(metadata.files[0].url, renamedInstallerName);
    assert.equal(metadata.files[0].sha512, expectedSha);
    assert.equal(metadata.files[0].size, bufferLength);
  };

  assertMetadataMatches(x64Metadata, x64Sha, x64Buffer.length);
  assertMetadataMatches(arm64Metadata, arm64Sha, arm64Buffer.length);

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
  const metadataFiles = [ia32.metadataPath, x64.metadataPath, linux.metadataPath, mac.metadataPath];
  for (const metadataPath of metadataFiles) {
    assert(metadataPath, 'metadataPath should be defined for all fixtures');
    const relativePath = path.relative(repoPath(), metadataPath);
    assert(manifestEntries.has(relativePath), `${relativePath} must be included in release manifest`);
  }

  const metadataDirs = await listMetadataDirectories(path.join(workspace, 'release-artifacts'));
  assert(metadataDirs.length >= metadataFiles.length, 'expected to discover metadata directories');

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

