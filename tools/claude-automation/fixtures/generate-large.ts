import { createWriteStream, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const targetBytes = Number(process.argv[2] ?? 110 * 1024 * 1024);
const outputDir = resolve(process.cwd(), 'tools', 'claude-automation', 'fixtures', '.local');
const outputPath = resolve(outputDir, `large-${Math.round(targetBytes / 1024 / 1024)}mb.log`);

mkdirSync(outputDir, { recursive: true });

const stream = createWriteStream(outputPath, { encoding: 'utf8' });
let written = 0;
let index = 0;

function writeMore(): void {
  while (written < targetBytes) {
    const line = `${new Date(1_700_000_000_000 + index * 1000).toISOString()} INFO sip.call id=${index} method=INVITE src=10.0.${index % 255}.${index % 31} dst=10.1.${index % 255}.${(index + 7) % 31} status=${index % 17 === 0 ? 503 : 200}\n`;
    written += Buffer.byteLength(line);
    index += 1;
    if (!stream.write(line)) {
      stream.once('drain', writeMore);
      return;
    }
  }

  stream.end();
}

stream.on('finish', () => {
  console.log(outputPath);
});

writeMore();
