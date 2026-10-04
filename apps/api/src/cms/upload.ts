import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import sharp from 'sharp';
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFStream, PDFObject } from 'pdf-lib';
import { extname } from 'node:path';

export const IMAGE_LIMIT = 5 * 1024 * 1024;
export const PDF_LIMIT = 10 * 1024 * 1024;
const kinds: Record<string, { mime: string; format: string; extension: string }> = {
  '.jpg': { mime: 'image/jpeg', format: 'jpeg', extension: 'jpg' },
  '.jpeg': { mime: 'image/jpeg', format: 'jpeg', extension: 'jpg' },
  '.png': { mime: 'image/png', format: 'png', extension: 'png' },
  '.webp': { mime: 'image/webp', format: 'webp', extension: 'webp' },
  '.avif': { mime: 'image/avif', format: 'heif', extension: 'avif' },
  '.pdf': { mime: 'application/pdf', format: 'pdf', extension: 'pdf' },
};
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
export async function validateUpload(file: UploadedFile | undefined) {
  const kind = file && kinds[extname(file.originalname).toLowerCase()];
  if (
    !file ||
    !kind ||
    kind.mime !== file.mimetype ||
    !file.buffer.length ||
    file.size !== file.buffer.length
  )
    throw new BadRequestException({ code: 'INVALID_MEDIA' });
  if (file.size > (kind.format === 'pdf' ? PDF_LIMIT : IMAGE_LIMIT))
    throw new PayloadTooLargeException();
  try {
    if (kind.format === 'pdf') {
      if (
        !file.buffer
          .subarray(0, 8)
          .toString('ascii')
          .match(/^%PDF-(?:1\.[0-7]|2\.0)/u) ||
        !/%%EOF\s*$/u.test(file.buffer.subarray(-1024).toString('latin1'))
      )
        throw new Error('Invalid PDF header');
      const pdf = await PDFDocument.load(file.buffer, {
        updateMetadata: false,
        throwOnInvalidObject: true,
      });
      if (!pdf.getPageCount() || pdf.getPageCount() > 1000) throw new Error('Invalid pages');
      const forbidden = [
        'JavaScript',
        'JS',
        'OpenAction',
        'AA',
        'Launch',
        'EmbeddedFiles',
        'EmbeddedFile',
        'RichMedia',
        'XFA',
        'SubmitForm',
        'ImportData',
      ];
      const seen = new Set<PDFObject>();
      let count = 0;
      const inspect = (object: PDFObject, depth = 0): void => {
        if (seen.has(object)) return;
        seen.add(object);
        if (depth > 64 || ++count > 100000) throw new Error('Complex PDF');
        if (object instanceof PDFDict) {
          for (const [key, nested] of object.entries()) {
            if (forbidden.includes(key.decodeText())) throw new Error('Active PDF content');
            inspect(nested, depth + 1);
          }
          const action = object.get(PDFName.of('S'));
          if (action instanceof PDFName && forbidden.includes(action.decodeText()))
            throw new Error('Active PDF action');
        } else if (object instanceof PDFArray) {
          for (const nested of object.asArray()) inspect(nested, depth + 1);
        } else if (object instanceof PDFStream) inspect(object.dict, depth + 1);
      };
      for (const [, object] of pdf.context.enumerateIndirectObjects()) inspect(object);
      return { bytes: file.buffer, mimeType: kind.mime, extension: kind.extension };
    }
    const decoder = sharp(file.buffer, {
      failOn: 'warning',
      limitInputPixels: 25_000_000,
      animated: false,
    });
    const info = await decoder.metadata();
    if (
      info.format !== kind.format ||
      !info.width ||
      !info.height ||
      info.width * info.height > 25_000_000 ||
      (info.pages ?? 1) > 1 ||
      (kind.extension === 'avif' && info.compression !== 'av1')
    )
      throw new Error('Image format mismatch');
    // Full decode and re-encode strips metadata and non-image trailing bytes.
    const bytes = await decoder.rotate().toBuffer();
    if (bytes.length > IMAGE_LIMIT) throw new PayloadTooLargeException();
    return { bytes, mimeType: kind.mime, extension: kind.extension };
  } catch (error) {
    if (error instanceof PayloadTooLargeException) throw error;
    throw new BadRequestException({ code: 'INVALID_MEDIA' });
  }
}
