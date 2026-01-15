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

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
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
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-card border-r border-border shadow-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Blaster</h1>
            <p className="text-xs text-muted-foreground">Disparo em Massa</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
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
                "mt-4 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/usuarios"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Shield
                className={cn(
                  "h-5 w-5",
                  location.pathname === "/usuarios" && "text-primary"
                )}
              />
              Usuários
            </Link>
          )}
        </nav>

        <div className="border-t border-border p-4">
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
