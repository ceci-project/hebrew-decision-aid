import { Link } from "react-router-dom";
import { storage } from "@/services/storage";

const HistoryPage = () => {
  const docs = storage.listDocuments();
  return (
    <div dir="rtl">
      <h1 className="text-2xl font-bold mb-4">היסטוריית מסמכים</h1>
      {docs.length === 0 ? (
        <p className="text-muted-foreground">אין מסמכים עדיין. <Link to="/" className="underline">צרו מסמך חדש</Link>.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((d) => (
            <li key={d.id} className="rounded-lg border p-4 bg-card">
              <h3 className="font-semibold mb-2">{d.title || "ללא כותרת"}</h3>
              <p className="text-xs text-muted-foreground mb-2">עודכן: {new Date(d.updatedAt).toLocaleString()}</p>
              <Link className="underline" to={`/editor/${d.id}`}>פתח</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default HistoryPage;
