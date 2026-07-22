/**
 * Client-side CV text extractor.
 * Reads a PDF or DOCX file and returns plain text for AI analysis.
 * Uses only browser-native APIs — no extra npm packages required.
 */

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    return extractFromPdf(file);
  }
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx")
  ) {
    return extractFromDocx(file);
  }
  // Fallback: plain text
  return file.text();
}

/** Extract text from PDF using pdf.js loaded from CDN */
async function extractFromPdf(file: File): Promise<string> {
  try {
    // Dynamically load pdf.js from CDN
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item: { str?: string }) => item.str ?? "")
        .join(" ");
      pages.push(text);
    }
    return pages.join("\n\n");
  } catch {
    // If pdf.js fails, return a descriptive placeholder so AI can still respond
    return `[PDF file: ${file.name}] — could not extract text client-side. Please paste your CV content manually.`;
  }
}

/** Dynamically load pdf.js from CDN */
async function loadPdfJs(): Promise<{
  getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
}> {
  const w = window as unknown as Record<string, unknown>;
  if (w["pdfjsLib"]) return w["pdfjsLib"] as ReturnType<typeof loadPdfJs> extends Promise<infer T> ? T : never;

  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  const lib = w["pdfjsLib"] as { GlobalWorkerOptions: { workerSrc: string } } & ReturnType<typeof loadPdfJs> extends Promise<infer T> ? T : never;
  (lib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return lib;
}

interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string }[] }> }>;
}

/** Extract text from DOCX using raw XML parsing */
async function extractFromDocx(file: File): Promise<string> {
  try {
    const JSZip = await loadJSZip();
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const xmlFile = zip.file("word/document.xml");
    if (!xmlFile) throw new Error("No document.xml");
    const xml = await xmlFile.async("string");
    // Strip XML tags and decode entities
    const text = xml
      .replace(/<w:p[ >]/g, "\n<w:p>")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return text;
  } catch {
    return `[DOCX file: ${file.name}] — could not extract text client-side. Please paste your CV content manually.`;
  }
}

async function loadJSZip(): Promise<{ loadAsync: (buf: ArrayBuffer) => Promise<JSZipInstance> }> {
  const w = window as unknown as Record<string, unknown>;
  if (w["JSZip"]) return w["JSZip"] as ReturnType<typeof loadJSZip> extends Promise<infer T> ? T : never;
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
  return w["JSZip"] as ReturnType<typeof loadJSZip> extends Promise<infer T> ? T : never;
}

interface JSZipInstance {
  file: (name: string) => { async: (type: "string") => Promise<string> } | null;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = reject;
    document.head.appendChild(el);
  });
}
