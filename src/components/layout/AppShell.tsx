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
        <div className="container mx-auto flex items-center justify-between py-3">
          <Link to="/" className="font-bold text-lg tracking-tight">
            Decision Advisor
          </Link>
          <nav className="flex items-center gap-1" dir="rtl">
            <NavLink to="/" label="בית" />
            <NavLink to="/history" label="היסטוריה" />
            <NavLink to="/login" label="התחברות" />
          </nav>
        </div>
      </header>
      <main className="container mx-auto py-8">{children}</main>
    </div>
  );
};

export default AppShell;
