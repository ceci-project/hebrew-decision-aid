import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { extractTextFromFile } from "@/utils/fileReaders";
import { storage } from "@/services/storage";
import type { DecisionDocument } from "@/types/models";

const Index = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handlePick = () => inputRef.current?.click();

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const { title, content } = await extractTextFromFile(file);
      const now = new Date().toISOString();
      const doc: DecisionDocument = {
        id: String(Date.now()),
        title: title || "החלטת ממשלה חדשה",
        content,
        createdAt: now,
        updatedAt: now,
      };
      storage.saveDocument(doc);
      toast({ title: "הקובץ נטען בהצלחה", description: "מעבירים למסך העורך" });
      navigate(`/editor/${doc.id}`);
    } catch (e) {
      toast({ title: "שגיאה בטעינת קובץ", description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            כלי ניתוח החלטות ממשלה
          </h1>
          <p className="text-lg text-gray-600">
            העלה מסמך החלטה לניתוח מקיף ומקבל הערות לשיפור
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center mb-8 hover:border-gray-400 transition-colors">
          <div className="flex flex-col items-center gap-4">
            {/* Upload Icon */}
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            
            <div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">העלאת מסמך חדש</h3>
              <p className="text-gray-500 mb-6">
                גרור קובץ DOCX או TXT לכאן, או לחץ לבחירה
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="px-6 py-3 text-gray-700 border-gray-300 hover:bg-gray-50"
                onClick={handlePick}
                disabled={busy}
              >
                + מסמך חדש
              </Button>
              <Button 
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handlePick}
                disabled={busy}
              >
                {busy ? "טוען..." : "בחר קובץ"}
              </Button>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".docx,.pdf"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] || undefined)}
          />
        </div>

        {/* File Info */}
        <div className="text-center text-sm text-gray-500 mb-8">
          גודל מקסימלי: 10MB | פורמטים נתמכים: DOCX, TXT
        </div>

        {/* Saved Documents */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">מסמכים שמורים (1)</h3>
            <Link 
              to="/history" 
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              צפה בהיסטוריה
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
