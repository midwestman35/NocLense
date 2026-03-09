export interface ZipEntry {
  name: string;
  content: string | Uint8Array;
}

const encoder = new TextEncoder();

function toBytes(content: string | Uint8Array): Uint8Array {
  return typeof content === 'string' ? encoder.encode(content) : content;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createArrayBuffer(length: number): { bytes: Uint8Array; view: DataView } {
  const buffer = new ArrayBuffer(length);
  return { bytes: new Uint8Array(buffer), view: new DataView(buffer) };
}

export function buildZip(entries: ZipEntry[]): Blob {
  const fileParts: Uint8Array[] = [];
  const centralDirectoryParts: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const contentBytes = toBytes(entry.content);
    const checksum = crc32(contentBytes);

    const local = createArrayBuffer(30 + nameBytes.length);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0, true);
    local.view.setUint16(8, 0, true);
    local.view.setUint16(10, 0, true);
    local.view.setUint16(12, 0, true);
    local.view.setUint32(14, checksum, true);
    local.view.setUint32(18, contentBytes.length, true);
    local.view.setUint32(22, contentBytes.length, true);
    local.view.setUint16(26, nameBytes.length, true);
    local.view.setUint16(28, 0, true);
    local.bytes.set(nameBytes, 30);

    fileParts.push(local.bytes, contentBytes);

    const central = createArrayBuffer(46 + nameBytes.length);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0, true);
    central.view.setUint16(10, 0, true);
    central.view.setUint16(12, 0, true);
    central.view.setUint16(14, 0, true);
    central.view.setUint32(16, checksum, true);
    central.view.setUint32(20, contentBytes.length, true);
    central.view.setUint32(24, contentBytes.length, true);
    central.view.setUint16(28, nameBytes.length, true);
    central.view.setUint16(30, 0, true);
    central.view.setUint16(32, 0, true);
    central.view.setUint16(34, 0, true);
    central.view.setUint16(36, 0, true);
    central.view.setUint32(38, 0, true);
    central.view.setUint32(42, offset, true);
    central.bytes.set(nameBytes, 46);

    centralDirectoryParts.push(central.bytes);
    offset += local.bytes.length + contentBytes.length;
  });

  const centralDirectorySize = centralDirectoryParts.reduce((total, part) => total + part.length, 0);
  const endRecord = createArrayBuffer(22);
  endRecord.view.setUint32(0, 0x06054b50, true);
  endRecord.view.setUint16(4, 0, true);
  endRecord.view.setUint16(6, 0, true);
  endRecord.view.setUint16(8, entries.length, true);
  endRecord.view.setUint16(10, entries.length, true);
  endRecord.view.setUint32(12, centralDirectorySize, true);
  endRecord.view.setUint32(16, offset, true);
  endRecord.view.setUint16(20, 0, true);

  const blobParts = [...fileParts, ...centralDirectoryParts, endRecord.bytes].map((part) =>
    part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer
  );

  return new Blob(blobParts, { type: 'application/zip' });
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
