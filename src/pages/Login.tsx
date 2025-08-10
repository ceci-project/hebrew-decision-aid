const LoginPage = () => {
  return (
    <div dir="rtl" className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full rounded-xl border p-6 bg-card">
        <h1 className="text-2xl font-bold mb-2 text-center">ברוכים הבאים</h1>
        <p className="text-sm text-muted-foreground mb-6 text-center">
          מסך התחברות דמה. עבור ניהול משתמשים ושמירה לחשבון, יש לחבר את Supabase.
        </p>
        <div className="text-center text-sm text-muted-foreground">
          אפשר להמשיך לשימוש ללא התחברות בשלב זה.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
