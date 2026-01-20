import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Send,
  Settings,
  Zap,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Contatos", href: "/contatos", icon: Users },
  { name: "Mensagens", href: "/mensagens", icon: MessageSquare },
  { name: "Campanhas", href: "/campanhas", icon: Send },
  { name: "Conexões", href: "/conexoes", icon: Zap },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [brandingLogoUrl, setBrandingLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const data = await api<{ logoUrl: string | null; faviconUrl: string | null }>(
          "/api/auth/branding",
          { auth: false }
        );
        if (data.logoUrl) {
          setBrandingLogoUrl(data.logoUrl);
        }
      } catch {
      }
    };

    loadBranding();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const brazilTime = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <aside className="bg-card border-b border-border shadow-card lg:fixed lg:left-0 lg:top-0 lg:z-40 lg:h-screen lg:w-56 lg:border-r">
      <div className="flex flex-col lg:h-full">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-border">
          {brandingLogoUrl ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background">
              <img
                src={brandingLogoUrl}
                alt="Logo"
                className="h-9 w-9 object-contain"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-foreground">Blaster</h1>
            <p className="text-xs text-muted-foreground">Disparo em Massa</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-3 lg:py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                {item.name}
              </Link>
            );
          })}
          {user?.role === "admin" && (
            <Link
              to="/usuarios"
              className={cn(
                "mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                location.pathname === "/usuarios"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Shield
                className={cn(
                  "h-4 w-4",
                  location.pathname === "/usuarios" && "text-primary"
                )}
              />
              Usuários
            </Link>
          )}
        </nav>

        <div className="border-t border-border p-4 hidden lg:block">
          <Button
            variant="outline"
            className="mb-3 flex w-full items-center justify-between text-sm font-medium"
            onClick={handleLogout}
          >
            <span>Sair</span>
            <Zap className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Versão 1.0.3 • TNS R2D2 • Horário Brasília: {brazilTime}
          </p>
        </div>
      </div>
    </aside>
  );
}
