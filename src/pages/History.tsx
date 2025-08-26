
import { Link } from "react-router-dom";
import { storage } from "@/services/storage";

const HistoryPage = () => {
  const docs = storage.listDocuments();
  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border-b border-gray-200 px-6 py-4 mb-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">היסטוריית מסמכים</h1>
              <p className="text-sm text-gray-500 mt-1">כל המסמכים השמורים במערכת</p>
            </div>
            <Link to="/">
              <button className="flex items-center text-gray-600 hover:text-gray-900">
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
                חזרה לבית
              </button>
            </Link>
          </div>
        </div>

        {docs.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500 mb-4">אין מסמכים עדיין במערכת</p>
            <Link to="/" className="text-blue-600 hover:text-blue-800 underline">
              צרו מסמך חדש
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {docs.map((doc) => (
              <div key={doc.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2">
                  {doc.title || "ללא כותרת"}
                </h3>
                <div className="text-sm text-gray-500 mb-4">
                  <div>נוצר: {new Date(doc.createdAt).toLocaleString('he-IL')}</div>
                  <div>עודכן: {new Date(doc.updatedAt).toLocaleString('he-IL')}</div>
                  <div className="mt-2">תווים: {doc.content.length.toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <Link 
                    to={`/editor/${doc.id}`}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-center text-sm"
                  >
                    פתח לעריכה
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm('האם אתם בטוחים שאתם רוצים למחוק את המסמך?')) {
                        storage.deleteDocument(doc.id);
                        window.location.reload();
                      }
                    }}
                    className="px-3 py-2 text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors text-sm"
                  >
                    מחק
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
