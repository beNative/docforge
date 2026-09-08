// @ts-expect-error plantuml-encoder has no official types
import plantumlEncoder from 'plantuml-encoder';
import type { DocumentOrFolder } from '../types';
import { exportDocumentDirectly, type DocumentExportResult } from './documentExportService';

/**
 * Checks if a document contains PlantUML code.
 */
export const isPlantUMLDocument = (doc: DocumentOrFolder): boolean => {
  if (doc.type !== 'document') return false;
  const lang = (doc.language_hint || '').toLowerCase();
  if (lang === 'plantuml' || lang === 'puml' || lang === 'uml') return true;
  const content = (doc.content || '').trim();
  return content.includes('@startuml');
};

/**
 * Renders PlantUML code to an SVG string using local Java renderer if available,
 * or the official remote PlantUML SVG endpoint as fallback.
 */
export const renderPlantUmlSvg = async (code: string, mode?: 'offline' | 'remote'): Promise<string> => {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new Error('PlantUML code is empty.');
  }

  // Ensure code has @startuml and @enduml markers
  let formattedCode = trimmed;
  if (!formattedCode.includes('@startuml')) {
    formattedCode = `@startuml\n${formattedCode}\n@enduml`;
  }

  // Try local renderer in desktop app
  if (mode !== 'remote' && typeof window !== 'undefined' && window.electronAPI?.renderPlantUML) {
    try {
      const res = await window.electronAPI.renderPlantUML(formattedCode, 'svg');
      if (res?.success && res.svg) {
        return res.svg;
      }
    } catch (err) {
      console.warn('Local PlantUML rendering failed, trying remote server:', err);
    }
  }

  // Fallback to remote plantuml server
  const encoded = plantumlEncoder.encode(formattedCode);
  const response = await fetch(`https://www.plantuml.com/plantuml/svg/${encoded}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch PlantUML SVG from remote server (${response.status} ${response.statusText})`);
  }
  return await response.text();
};

/**
 * Converts an SVG string into high-resolution PNG or JPEG byte array via HTML5 Canvas.
 */
export const svgToRasterBytes = async (
  svgString: string,
  format: 'image/png' | 'image/jpeg',
  options?: { scale?: number; backgroundColor?: string }
): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    try {
      const scale = options?.scale ?? 2;

      // Extract width & height from SVG
      let width = 800;
      let height = 600;

      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (svgEl) {
          const w = parseFloat(svgEl.getAttribute('width') || '0');
          const h = parseFloat(svgEl.getAttribute('height') || '0');
          if (w > 0 && h > 0) {
            width = w;
            height = h;
          } else {
            const viewBox = svgEl.getAttribute('viewBox');
            if (viewBox) {
              const parts = viewBox.trim().split(/\s+/).map(parseFloat);
              if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
                width = parts[2];
                height = parts[3];
              }
            }
          }
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D rendering context is not available.');
      }

      // JPEG requires a solid background to avoid turning transparent areas black
      if (format === 'image/jpeg' || options?.backgroundColor) {
        ctx.fillStyle = options?.backgroundColor || '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobUrl);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to generate raster image from canvas.'));
              return;
            }
            blob.arrayBuffer().then((buffer) => {
              resolve(new Uint8Array(buffer));
            }).catch(reject);
          },
          format,
          format === 'image/jpeg' ? 0.95 : undefined
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Failed to load SVG into raster image.'));
      };

      img.src = blobUrl;
    } catch (err) {
      reject(err);
    }
  });
};

export type PlantUmlExportFormat = 'png' | 'svg' | 'jpg' | 'puml';

/**
 * Exports a PlantUML document into the requested target format.
 */
export const exportPlantUmlDocument = async (
  doc: DocumentOrFolder,
  format: PlantUmlExportFormat,
  mode?: 'offline' | 'remote'
): Promise<DocumentExportResult> => {
  const code = doc.content || '';

  if (format === 'puml') {
    return exportDocumentDirectly(doc, {
      format: 'puml',
      data: code,
      isBinary: false,
      mimeType: 'text/plain;charset=utf-8',
      fileFilterName: 'PlantUML Source',
      extension: 'puml',
    });
  }

  const svg = await renderPlantUmlSvg(code, mode);

  if (format === 'svg') {
    return exportDocumentDirectly(doc, {
      format: 'svg',
      data: svg,
      isBinary: false,
      mimeType: 'image/svg+xml;charset=utf-8',
      fileFilterName: 'SVG Vector Image',
      extension: 'svg',
    });
  }

  if (format === 'png') {
    const pngBytes = await svgToRasterBytes(svg, 'image/png', { scale: 2 });
    return exportDocumentDirectly(doc, {
      format: 'png',
      data: pngBytes,
      isBinary: true,
      mimeType: 'image/png',
      fileFilterName: 'PNG Image',
      extension: 'png',
    });
  }

  if (format === 'jpg') {
    const jpgBytes = await svgToRasterBytes(svg, 'image/jpeg', { scale: 2, backgroundColor: '#ffffff' });
    return exportDocumentDirectly(doc, {
      format: 'jpg',
      data: jpgBytes,
      isBinary: true,
      mimeType: 'image/jpeg',
      fileFilterName: 'JPEG Image',
      extension: 'jpg',
    });
  }

  throw new Error(`Unsupported export format: ${format}`);
};
