import { promises as fs } from 'fs';
import path from 'path';
import iconGen from 'icon-gen';
import { XMLParser } from 'fast-xml-parser';

const ASSETS_DIR = path.resolve('assets');
const EXPECTED_FILENAMES = {
  ico: 'icon.ico',
  icns: 'icon.icns',
  png: 'icon.png',
};

async function findSvgIcon() {
  const entries = await fs.readdir(ASSETS_DIR);
  const svgCandidates = entries.filter((name) => name.toLowerCase().endsWith('.svg'));
  if (svgCandidates.length === 0) {
    console.warn('[icon] No SVG asset found in assets directory. Existing binary icons will be used.');
    return null;
  }

  const prioritized = svgCandidates.find((name) => name.toLowerCase() === 'icon.svg');
  const svgName = prioritized ?? svgCandidates[0];
  const svgPath = path.join(ASSETS_DIR, svgName);

  try {
    const svgContent = await fs.readFile(svgPath, 'utf8');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    const parsed = parser.parse(svgContent);
    if (!parsed || typeof parsed !== 'object' || !parsed.svg) {
      console.warn(`[icon] ${svgName} is not a valid SVG document. Skipping automated icon generation.`);
      return null;
    }

    const { width, height, viewBox } = parsed.svg;
    if (!width && !height && !viewBox) {
      console.warn(`[icon] ${svgName} is missing size metadata (width/height/viewBox). Skipping automated icon generation.`);
      return null;
    }

    return { svgPath, svgName };
  } catch (error) {
    console.warn(`[icon] Failed to read ${svgName}:`, error);
    return null;
  }
}

async function generateIcons(svgPath, svgName) {
  console.info(`[icon] Generating binary icons from ${svgName} ...`);
  await iconGen(svgPath, ASSETS_DIR, {
    report: false,
    ico: { name: 'icon' },
    icns: { name: 'icon' },
    favicon: { name: 'icon-', pngSizes: [256, 512], icoSizes: [16, 32] },
  });

  const dirEntries = await fs.readdir(ASSETS_DIR);
  const pngCandidates = dirEntries
    .filter((name) => name.toLowerCase().startsWith('icon') && name.toLowerCase().endsWith('.png') && name !== EXPECTED_FILENAMES.png)
    .sort((a, b) => {
      const sizeFromName = (file) => {
        const match = file.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      };
      return sizeFromName(b) - sizeFromName(a);
    });

  for (const candidate of pngCandidates) {
    const sourcePath = path.join(ASSETS_DIR, candidate);
    try {
      await fs.copyFile(sourcePath, path.join(ASSETS_DIR, EXPECTED_FILENAMES.png));
      console.info(`[icon] Created ${EXPECTED_FILENAMES.png} from ${candidate}.`);
      return;
    } catch (error) {
      console.warn(`[icon] Failed to promote ${candidate} to ${EXPECTED_FILENAMES.png}:`, error);
    }
  }

  console.warn('[icon] Generated PNG variants were not found. Electron Builder may fall back to SVG on supported platforms.');
}

async function main() {
  const svgInfo = await findSvgIcon();
  if (!svgInfo) {
    return;
  }

  try {
    await generateIcons(svgInfo.svgPath, svgInfo.svgName);
  } catch (error) {
    console.error('[icon] Failed to generate platform icons from SVG. Existing assets will remain untouched.', error);
  }
}

main().catch((error) => {
  console.error('[icon] Unexpected error while preparing icons:', error);
  process.exitCode = 1;
});
