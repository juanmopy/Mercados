import { PassThrough } from 'stream';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ZipArchive } = require('archiver');

interface DeliveryForZIP {
  cedula: string;
  fullName: string;
  photoBuffer: Buffer;
}

function normalizeFileName(name: string): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

export async function generatePhotosZIP(deliveries: DeliveryForZIP[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ store: true });
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();

    passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
    passThrough.on('end', () => resolve(Buffer.concat(chunks)));
    passThrough.on('error', reject);
    archive.on('error', reject);

    archive.pipe(passThrough);

    for (const d of (deliveries ?? [])) {
      if (!d?.photoBuffer) continue;
      const fileName = `${d.cedula}_${normalizeFileName(d.fullName)}.jpg`;
      archive.append(d.photoBuffer, { name: fileName });
    }

    archive.finalize();
  });
}
