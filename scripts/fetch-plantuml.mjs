import { createWriteStream, createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const PLANTUML_VERSION = '1.2022.7';
const DOWNLOAD_URL = `https://github.com/plantuml/plantuml/releases/download/v${PLANTUML_VERSION}/plantuml.jar`;
const EXPECTED_SHA256 = 'eaea0c5777f3ee2c484046d115e2404156bd005961d37dd219f03ae5650375b8';
const FORCE_DOWNLOAD = process.env.FORCE_DOWNLOAD_PLANTUML === 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(repoRoot, 'assets', 'plantuml');
const jarPath = path.join(assetsDir, 'plantuml.jar');

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          download(response.headers.location, destination).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Failed to download PlantUML jar (status: ${response.statusCode}).`));
          return;
        }

        const fileStream = createWriteStream(destination);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close(resolve);
        });
        fileStream.on('error', (error) => {
          reject(error);
        });
      })
      .on('error', reject);
  });
}

async function ensureJar() {
  await fs.mkdir(assetsDir, { recursive: true });

  if (!FORCE_DOWNLOAD && (await fileExists(jarPath))) {
    const currentHash = await sha256(jarPath);
    if (currentHash === EXPECTED_SHA256) {
      console.log('PlantUML jar already present and verified.');
      return;
    }

    console.warn('Existing PlantUML jar hash mismatch. Re-downloading.');
    await fs.unlink(jarPath);
  }

  const tempFile = path.join(assetsDir, `plantuml.${Date.now()}.download`);
  console.log(`Downloading PlantUML ${PLANTUML_VERSION} from ${DOWNLOAD_URL}`);
  await download(DOWNLOAD_URL, tempFile);

  const downloadedHash = await sha256(tempFile);
  if (downloadedHash !== EXPECTED_SHA256) {
    await fs.unlink(tempFile).catch(() => {});
    throw new Error('Downloaded PlantUML jar failed integrity check.');
  }

  await fs.rename(tempFile, jarPath);
  console.log('PlantUML jar downloaded and verified.');
}

ensureJar().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
