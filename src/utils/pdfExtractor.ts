/**
 * pdfExtractor.ts
 *
 * Client-side PDF text extraction using pdf.js.
 * Returns the full text content of a PDF as a single string.
 *
 * Uses dynamic import to avoid loading the 2.2MB pdf.js worker
 * in the initial bundle — only loaded when a PDF is actually opened.
 */

let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null;

/** Lazy-load pdfjs-dist on first use */
function getPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsReady) {
    pdfjsReady = import('pdfjs-dist').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsReady;
}

/**
 * Extract all text from a PDF blob, page by page.
 * Returns the concatenated text with page separators.
 */
export async function extractTextFromPdf(blob: Blob): Promise<string> {
  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: unknown) => {
        const t = item as { str?: string; hasEOL?: boolean };
        return (t.str ?? '') + (t.hasEOL ? '\n' : '');
      })
      .join('');
    pages.push(text);
  }

  return pages.join('\n---PAGE---\n');
}
