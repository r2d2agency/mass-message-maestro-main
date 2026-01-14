import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentCampaigns } from "@/components/dashboard/RecentCampaigns";
import { Users, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ApiContact {
  id: string;
}

interface ApiCampaign {
  id: string;
  status: "pending" | "running" | "paused" | "completed" | "cancelled";
  sent_count: string;
  failed_count: string;
}

const Index = () => {
  const [totalContacts, setTotalContacts] = useState(0);
  const [sentMessages, setSentMessages] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [deliveryRate, setDeliveryRate] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        const [contacts, campaigns] = await Promise.all([
          api<ApiContact[]>("/api/contacts"),
          api<ApiCampaign[]>("/api/campaigns"),
        ]);

        setTotalContacts(contacts.length);

        const active = campaigns.filter((c) => c.status === "running").length;
        setActiveCampaigns(active);

        const sent = campaigns.reduce(
          (sum, c) => sum + (Number(c.sent_count) || 0),
          0
        );
        const failed = campaigns.reduce(
          (sum, c) => sum + (Number(c.failed_count) || 0),
          0
        );
        setSentMessages(sent);

        const total = sent + failed;
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
  }, [toast]);

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Visão geral do seu sistema de disparo de mensagens
          </p>
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
            description="Somatório das campanhas"
            icon={<Send className="h-6 w-6 text-primary" />}
          />
          <StatsCard
            title="Campanhas Ativas"
            value={isLoading ? "Carregando..." : activeCampaigns}
            description="Em execução agora"
            icon={<MessageSquare className="h-6 w-6 text-primary" />}
          />
          <StatsCard
            title="Taxa de Entrega"
            value={
              isLoading
                ? "Carregando..."
                : `${deliveryRate.toFixed(1)}%`
            }
            description="Média geral"
            icon={<CheckCircle2 className="h-6 w-6 text-primary" />}
          />
        </div>

        {/* Recent Campaigns */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentCampaigns />
          
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
