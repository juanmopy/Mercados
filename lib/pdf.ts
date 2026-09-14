import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { formatBogota } from './timezone';

interface DeliveryForPDF {
  id: string;
  beneficiaryName: string;
  beneficiaryCedula: string;
  serverTimestamp: Date;
  correctedTimestamp?: Date | null;
  photoBuffer: Buffer;
}

export async function generateDeliveryPDF(deliveries: DeliveryForPDF[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 36;
  const PHOTO_W = PAGE_W - MARGIN * 2;
  const PHOTO_H = 600;
  const TEXT_LINE_H = 12;
  const ITEMS_PER_PAGE = 1;

  const totalPages = Math.ceil((deliveries?.length ?? 0) / ITEMS_PER_PAGE);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const pageItems = (deliveries ?? []).slice(startIdx, startIdx + ITEMS_PER_PAGE);

    const item = pageItems[0];
    if (!item) continue;
    const pos = {
      x: (PAGE_W - PHOTO_W) / 2,
      y: 140,
    };

    try {
      let image;
      try {
        image = await pdfDoc.embedJpg(item.photoBuffer);
      } catch {
        try {
          image = await pdfDoc.embedPng(item.photoBuffer);
        } catch {
          // Skip if can't embed
          continue;
        }
      }

      // Scale image to fit box
      const scale = Math.min(PHOTO_W / (image.width || 1), PHOTO_H / (image.height || 1));
      const drawW = (image.width || PHOTO_W) * scale;
      const drawH = (image.height || PHOTO_H) * scale;
      const offsetX = (PHOTO_W - drawW) / 2;
      const offsetY = (PHOTO_H - drawH) / 2;

      page.drawImage(image, {
        x: pos.x + offsetX,
        y: pos.y + offsetY,
        width: drawW,
        height: drawH,
      });
    } catch {
      // Draw placeholder rectangle
      page.drawRectangle({
        x: pos.x,
        y: pos.y,
        width: PHOTO_W,
        height: PHOTO_H,
        borderColor: rgb(0.5, 0.5, 0.5),
        borderWidth: 1,
      });
    }

    // Text below photo
    const textY = pos.y - TEXT_LINE_H - 4;
    const timestamp = item.correctedTimestamp ?? item.serverTimestamp;
    const dateStr = formatBogota(timestamp);

    page.drawText(item.beneficiaryName ?? 'Sin nombre', {
      x: pos.x,
      y: textY,
      size: 9,
      font: fontBold,
      color: rgb(0, 0, 0),
      maxWidth: PHOTO_W,
    });
    page.drawText(`CC: ${item.beneficiaryCedula ?? ''}`, {
      x: pos.x,
      y: textY - TEXT_LINE_H,
      size: 8,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(dateStr, {
      x: pos.x,
      y: textY - TEXT_LINE_H * 2,
      size: 8,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Page number
    const pageNumText = `P\u00e1gina ${pageIdx + 1} de ${totalPages}`;
    const textWidth = font.widthOfTextAtSize(pageNumText, 9);
    page.drawText(pageNumText, {
      x: (PAGE_W - textWidth) / 2,
      y: 20,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  return pdfDoc.save();
}
