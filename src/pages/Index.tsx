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
    <div dir="rtl" className="min-h-[60vh] grid place-items-center">
      <section className="w-full max-w-3xl rounded-2xl border bg-card p-8 shadow-sm">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Decision Advisor</h1>
          <p className="text-muted-foreground">כלי לכתיבה וניתוח החלטות ממשלה – בעברית, מותאם לכותבי מדיניות.</p>
        </header>

        <div className="flex flex-col items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".docx,.pdf"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] || undefined)}
          />
          <Button disabled={busy} onClick={handlePick}>
            {busy ? "טוען..." : "העלו מסמך (DOCX/PDF)"}
          </Button>
          <p className="text-xs text-muted-foreground">מגבלת גודל: 10MB</p>
          <div className="text-sm">
            או <Link className="underline" to="/history">עברו להיסטוריית מסמכים</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
