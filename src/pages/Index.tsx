import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentCampaigns } from "@/components/dashboard/RecentCampaigns";
import { Users, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ApiContact {
  id: string;
}

interface ApiDashboardStatsResponse {
  messages: {
    total: number | string;
    sent: number | string;
    failed: number | string;
  };
  campaigns: {
    totalInPeriod: number | string;
    activeNow: number | string;
  };
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const Index = () => {
  const [totalContacts, setTotalContacts] = useState(0);
  const [sentMessages, setSentMessages] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [deliveryRate, setDeliveryRate] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatDateInput(d);
  });
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()));

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        params.set("startDate", startDate);
        params.set("endDate", endDate);

        const [contacts, dashboard] = await Promise.all([
          api<ApiContact[]>("/api/contacts"),
          api<ApiDashboardStatsResponse>(`/api/campaigns/dashboard/stats?${params.toString()}`),
        ]);

        setTotalContacts(contacts.length);

        const sent = Number(dashboard.messages.sent) || 0;
        const failed = Number(dashboard.messages.failed) || 0;
        const total = Number(dashboard.messages.total) || sent + failed;

        setSentMessages(sent);
        setActiveCampaigns(Number(dashboard.campaigns.totalInPeriod) || 0);

        const rate = total > 0 ? (sent / total) * 100 : 0;
        setDeliveryRate(rate);
      } catch (error) {
        toast({
          title: "Erro ao carregar estatísticas",
          description:
            error instanceof Error ? error.message : "Tente novamente mais tarde",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [toast, startDate, endDate]);

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-slide-up flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Visão geral do seu sistema de disparo de mensagens
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total de Contatos"
            value={
              isLoading
                ? "Carregando..."
                : totalContacts.toLocaleString("pt-BR")
            }
            description="Em todas as listas"
            icon={<Users className="h-6 w-6 text-primary" />}
          />
          <StatsCard
            title="Mensagens Enviadas"
            value={
              isLoading
                ? "Carregando..."
                : sentMessages.toLocaleString("pt-BR")
            }
            description="No período"
            icon={<Send className="h-6 w-6 text-primary" />}
          />
          <StatsCard
            title="Campanhas"
            value={isLoading ? "Carregando..." : activeCampaigns}
            description="No período"
            icon={<MessageSquare className="h-6 w-6 text-primary" />}
          />
          <StatsCard
            title="Taxa de Entrega"
            value={
              isLoading
                ? "Carregando..."
                : `${deliveryRate.toFixed(1)}%`
            }
            description="No período"
            icon={<CheckCircle2 className="h-6 w-6 text-primary" />}
          />
        </div>

        {/* Recent Campaigns */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentCampaigns startDate={startDate} endDate={endDate} />
          
          {/* Quick Actions */}
          <div className="rounded-xl bg-card p-6 shadow-card border border-border animate-fade-in">
            <h3 className="mb-6 text-lg font-semibold text-foreground">
              Ações Rápidas
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <a
                href="/contatos"
                className="flex flex-col items-center gap-3 rounded-lg border border-border p-6 transition-all duration-200 hover:border-primary hover:bg-accent"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Importar Contatos
                </span>
              </a>
              <a
                href="/mensagens"
                className="flex flex-col items-center gap-3 rounded-lg border border-border p-6 transition-all duration-200 hover:border-primary hover:bg-accent"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Criar Mensagem
                </span>
              </a>
              <a
                href="/campanhas"
                className="flex flex-col items-center gap-3 rounded-lg border border-border p-6 transition-all duration-200 hover:border-primary hover:bg-accent sm:col-span-2"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                  <Send className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Nova Campanha
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
