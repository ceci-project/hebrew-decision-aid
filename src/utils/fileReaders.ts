import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker - use local file to avoid CORS issues
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

export interface ExtractResult {
  title: string;
  content: string;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true, // Better support for Hebrew fonts
    });
    
    const pdf = await loadingTask.promise;
    const textParts: string[] = [];
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Concatenate text items with proper spacing
      const pageText = textContent.items
        .map((item: any) => {
          // Handle RTL text properly
          if ('str' in item) {
            return item.str;
          }
          return '';
        })
        .join(' ');
      
      if (pageText.trim()) {
        textParts.push(pageText);
      }
    }
    
    // Join all pages with double newline
    const fullText = textParts.join('\n\n').trim();
    
    if (!fullText) {
      throw new Error("לא נמצא טקסט בקובץ ה-PDF");
    }
    
    return fullText;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    throw new Error("שגיאה בקריאת קובץ PDF. ייתכן שהקובץ מוגן או פגום.");
  }
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  if (file.size > MAX_SIZE) {
    throw new Error("הקובץ גדול מדי (מעל 10MB)");
  }

  const name = file.name.replace(/\.[^.]+$/, "");

  // Handle DOCX files
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = (result.value || "").trim();
    if (!text) throw new Error("לא נמצא טקסט במסמך");
    return { title: name, content: text };
  }

  // Handle PDF files
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractTextFromPDF(arrayBuffer);
    return { title: name, content: text };
  }

  throw new Error("פורמט קובץ לא נתמך. קבצים נתמכים: DOCX, PDF");
}
