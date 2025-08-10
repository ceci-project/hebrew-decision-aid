import mammoth from "mammoth";

export interface ExtractResult {
  title: string;
  content: string;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  if (file.size > MAX_SIZE) {
    throw new Error("הקובץ גדול מדי (מעל 10MB)");
  }

  const name = file.name.replace(/\.[^.]+$/, "");

  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = (result.value || "").trim();
    if (!text) throw new Error("לא נמצא טקסט במסמך");
    return { title: name, content: text };
  }

  // Placeholder for PDF (to be implemented after backend/worker setup)
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("תמיכה ב-PDF תתווסף בקרוב. נא להשתמש ב-DOCX בשלב זה.");
  }

  throw new Error("פורמט קובץ לא נתמך. קבצים נתמכים: DOCX, PDF");
}
