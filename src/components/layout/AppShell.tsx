import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const NavLink = ({ to, label }: { to: string; label: string }) => {
  const loc = useLocation();
  const active = loc.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "px-3 py-2 rounded-md text-sm font-medium transition-colors",
        active ? "bg-secondary text-secondary-foreground" : "hover:bg-accent"
      )}
    >
      {label}
    </Link>
  );
};

const AppShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-gradient-primary">
      <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img 
                src="/lovable-uploads/78f51a25-837d-4a25-a4cf-e0981aa6f079.png" 
                alt="Ceci.AI Logo" 
                className="h-12 w-auto"
              />
            </div>
            <nav className="flex items-center gap-1" dir="rtl">
              <NavLink to="/" label="בית" />
              <NavLink to="/history" label="היסטוריה" />
              <NavLink to="/login" label="התחברות" />
            </nav>
          </div>
          <div className="text-center" dir="rtl">
            <h1 className="text-2xl font-bold mb-3">ברוכים הבאים ל-CeciAI</h1>
            <p className="text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            בהתבסס על מאגר של יותר מ-25,000 החלטות ממשלה ומאות דוחות מוניטור, תוכלו לסקור החלטות עבר, לנתח טיוטת החלטה לפי קריטריונים מקצועיים, ולקבל שיפורים שיהפכו אותה לישימה וברורה יותר.
            </p>
          </div>
        </div>
      </header>
      <main className="container mx-auto py-8">{children}</main>
    </div>
  );
};

export default AppShell;
