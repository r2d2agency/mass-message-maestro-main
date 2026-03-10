import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentCampaigns } from "@/components/dashboard/RecentCampaigns";
import { Users, MessageSquare, Send, CheckCircle2, Filter } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ApiContact {
  id: string;
}

interface ApiConnection {
  id: string;
  name: string;
  status: string;
}

interface ApiCampaignOption {
  id: string;
  name: string;
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

function getRangeLastDays(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: formatDateInput(start), endDate: formatDateInput(end) };
}

function getRangeThisMonth() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { startDate: formatDateInput(start), endDate: formatDateInput(end) };
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

  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("all");
  const [campaignOptions, setCampaignOptions] = useState<ApiCampaignOption[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [campaignSearch, setCampaignSearch] = useState("");

  useEffect(() => {
    const loadConnections = async () => {
      try {
        const data = await api<ApiConnection[]>("/api/connections");
        setConnections(data);
        if (data.length === 1) {
          setSelectedConnectionId(data[0].id);
        }
      } catch (error) {
        toast({
          title: "Erro ao carregar conexões",
          description:
            error instanceof Error ? error.message : "Tente novamente mais tarde",
          variant: "destructive",
        });
      }
    };

    loadConnections();
  }, [toast]);

  useEffect(() => {
    const loadCampaignOptions = async () => {
      try {
        const params = new URLSearchParams();
        params.set("limit", "200");
        if (selectedConnectionId !== "all") {
          params.set("connectionId", selectedConnectionId);
        }

        const data = await api<ApiCampaignOption[]>(`/api/campaigns?${params.toString()}`);
        setCampaignOptions(
          data.map((c) => ({
            id: c.id,
            name: c.name,
          }))
        );

        setSelectedCampaignIds((prev) => {
          const allowed = new Set(data.map((c) => c.id));
          return prev.filter((id) => allowed.has(id));
        });
      } catch (error) {
        toast({
          title: "Erro ao carregar campanhas",
          description:
            error instanceof Error ? error.message : "Tente novamente mais tarde",
          variant: "destructive",
        });
      }
    };

    loadCampaignOptions();
  }, [toast, selectedConnectionId]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        params.set("startDate", startDate);
        params.set("endDate", endDate);
        if (selectedConnectionId !== "all") {
          params.set("connectionId", selectedConnectionId);
        }
        if (selectedCampaignIds.length > 0) {
          params.set("campaignIds", selectedCampaignIds.join(","));
        }

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
  }, [toast, startDate, endDate, selectedConnectionId, selectedCampaignIds]);

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

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const range = getRangeThisMonth();
                  setStartDate(range.startDate);
                  setEndDate(range.endDate);
                }}
              >
                Este mês
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const range = getRangeLastDays(7);
                  setStartDate(range.startDate);
                  setEndDate(range.endDate);
                }}
              >
                7 dias
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const range = getRangeLastDays(30);
                  setStartDate(range.startDate);
                  setEndDate(range.endDate);
                }}
              >
                30 dias
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const range = getRangeLastDays(90);
                  setStartDate(range.startDate);
                  setEndDate(range.endDate);
                }}
              >
                90 dias
              </Button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Conexão</Label>
                <Select
                  value={selectedConnectionId}
                  onValueChange={(value) => {
                    setSelectedConnectionId(value);
                    setSelectedCampaignIds([]);
                  }}
                >
                  <SelectTrigger className="min-w-[220px]">
                    <SelectValue placeholder="Selecione uma conexão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as conexões</SelectItem>
                    {connections.map((connection) => (
                      <SelectItem key={connection.id} value={connection.id}>
                        {connection.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Campanhas</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[220px] justify-between">
                      <span className="truncate">
                        {selectedCampaignIds.length > 0
                          ? `${selectedCampaignIds.length} selecionada(s)`
                          : "Todas as campanhas"}
                      </span>
                      <Filter className="h-4 w-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80">
                    <div className="space-y-3">
                      <Input
                        placeholder="Buscar campanha..."
                        value={campaignSearch}
                        onChange={(e) => setCampaignSearch(e.target.value)}
                      />

                      <div className="flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedCampaignIds([])}
                          disabled={selectedCampaignIds.length === 0}
                        >
                          Limpar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedCampaignIds(campaignOptions.map((c) => c.id))}
                          disabled={campaignOptions.length === 0}
                        >
                          Selecionar todas
                        </Button>
                      </div>

                      <ScrollArea className="h-64 rounded-md border border-border">
                        <div className="p-3 space-y-2">
                          {campaignOptions
                            .filter((c) =>
                              c.name.toLowerCase().includes(campaignSearch.toLowerCase())
                            )
                            .map((c) => (
                              <div key={c.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`dash-campaign-${c.id}`}
                                  checked={selectedCampaignIds.includes(c.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedCampaignIds((prev) => [...prev, c.id]);
                                    } else {
                                      setSelectedCampaignIds((prev) => prev.filter((id) => id !== c.id));
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`dash-campaign-${c.id}`}
                                  className="text-sm font-normal cursor-pointer flex-1"
                                >
                                  {c.name}
                                </Label>
                              </div>
                            ))}
                          {campaignOptions.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              Nenhuma campanha encontrada para o período/conexão.
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

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

            {selectedConnectionId !== "all" && selectedCampaignIds.length > 0 && (
              <p className="text-xs text-muted-foreground sm:text-right">
                Filtrando por conexão e campanhas selecionadas.
              </p>
            )}

            {selectedConnectionId !== "all" && selectedCampaignIds.length === 0 && (
              <p className="text-xs text-muted-foreground sm:text-right">
                Filtrando por conexão.
              </p>
            )}

            {selectedConnectionId === "all" && selectedCampaignIds.length > 0 && (
              <p className="text-xs text-muted-foreground sm:text-right">
                Filtrando por campanhas selecionadas.
              </p>
            )}

            {selectedConnectionId === "all" && selectedCampaignIds.length === 0 && (
              <p className="text-xs text-muted-foreground sm:text-right">
                Filtrando por período.
              </p>
            )}

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
          <RecentCampaigns
            startDate={startDate}
            endDate={endDate}
            connectionId={selectedConnectionId !== "all" ? selectedConnectionId : undefined}
            campaignIds={selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined}
          />
          
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
