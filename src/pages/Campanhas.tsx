import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import {
  Send,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Timer,
  Users,
  MessageSquare,
  Shuffle,
  Pencil,
  Download,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { uploadFile, API_URL } from "@/lib/api";

const SETTINGS_STORAGE_KEY = "app_settings";

interface AppSettings {
  dailyLimit: number | null;
  minPauseSeconds: number | null;
  maxPauseSeconds: number | null;
}

type UiCampaignStatus = "scheduled" | "running" | "completed" | "paused";

interface Campaign {
  id: string;
  name: string;
  status: UiCampaignStatus;
  listName?: string;
  messageName?: string;
  totalContacts: number;
  sentMessages: number;
  failedMessages?: number;
  scheduledAt?: string;
  connectionId: string;
  listId: string;
  messageId: string;
  scheduledAtRaw?: string | null;
  endAtRaw?: string | null;
  minDelay?: number | null;
  maxDelay?: number | null;
}

interface SendLog {
  id: string;
  campaignId: string;
  contactName: string;
  phone: string;
  status: "sent" | "failed" | "pending";
  sentAt: string;
  scheduledFor: string;
  errorMessage: string | null;
}

interface ApiCampaign {
  id: string;
  name: string;
  status: "pending" | "running" | "paused" | "completed" | "cancelled";
  list_name?: string;
  message_name?: string;
  message_id: string;
  message_ids?: string[];
  scheduled_at?: string | null;
  end_at?: string | null;
  min_delay?: number | null;
  max_delay?: number | null;
  connection_id: string;
  list_id: string;
  created_at: string;
  sent_count?: number;
  failed_count?: number;
}

interface ApiSendLog {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  contact_name: string | null;
  phone: string;
  status: "sent" | "failed" | "pending" | "processing";
  sent_at: string | null;
  scheduled_for: string | null;
  error_message: string | null;
  created_at: string;
}

interface ApiContactList {
  id: string;
  name: string;
  contact_count: number;
}

interface ApiMessageTemplate {
  id: string;
  name: string;
}

interface ApiConnection {
  id: string;
  name: string;
  status: string;
}

interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

interface CampaignStatsResponse {
  campaign: {
    id: string;
    status: string;
    sent_count: number;
    failed_count: number;
  };
  stats: {
    total: string;
    sent: string;
    failed: string;
    pending: string;
  };
}

const statusConfig = {
  scheduled: { icon: CalendarIcon, label: "Agendada", color: "text-muted-foreground", bgColor: "bg-muted" },
  running: { icon: Play, label: "Em Execução", color: "text-warning", bgColor: "bg-warning/10" },
  completed: { icon: CheckCircle2, label: "Concluída", color: "text-success", bgColor: "bg-success/10" },
  paused: { icon: Pause, label: "Pausada", color: "text-destructive", bgColor: "bg-destructive/10" },
};

const mapStatus = (status: ApiCampaign["status"]): UiCampaignStatus => {
  if (status === "pending") return "scheduled";
  if (status === "cancelled") return "paused";
  if (status === "running" || status === "completed" || status === "paused") {
    return status;
  }
  return "scheduled";
};

const Campanhas = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("list");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [selectedMessageId, setSelectedMessageId] = useState<string>(""); // Keep for backward compatibility/single select fallback if needed
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [minDelayInput, setMinDelayInput] = useState("30");
  const [maxDelayInput, setMaxDelayInput] = useState("120");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [lists, setLists] = useState<ApiContactList[]>([]);
  const [messages, setMessages] = useState<ApiMessageTemplate[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [monitorStats, setMonitorStats] = useState<CampaignStats>({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
  });
  const [isLoadingMonitor, setIsLoadingMonitor] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoadingCampaigns(true);

        const [campaignsData, connectionsData, listsData, messagesData] =
          await Promise.all([
            api<ApiCampaign[]>("/api/campaigns"),
            api<ApiConnection[]>("/api/connections"),
            api<ApiContactList[]>("/api/contacts/lists"),
            api<ApiMessageTemplate[]>("/api/messages"),
          ]);

        const mappedCampaigns = campaignsData.map((campaign) => {
          const sent = Number(campaign.sent_count) || 0;
          const failed = Number(campaign.failed_count) || 0;
          const total = sent + failed;
          const scheduledDate = campaign.scheduled_at || campaign.created_at;
          const scheduledAt = scheduledDate
            ? new Date(scheduledDate).toLocaleString("pt-BR")
            : undefined;

          return {
            id: campaign.id,
            name: campaign.name,
            status: mapStatus(campaign.status),
            listName: campaign.list_name,
            messageName: campaign.message_name,
            totalContacts: total,
            sentMessages: sent,
            failedMessages: failed,
            scheduledAt,
            connectionId: campaign.connection_id,
            listId: campaign.list_id,
            messageId: campaign.message_id,
            scheduledAtRaw: campaign.scheduled_at ?? null,
            endAtRaw: campaign.end_at ?? null,
            minDelay: campaign.min_delay ?? null,
            maxDelay: campaign.max_delay ?? null,
          };
        });

        setCampaigns(mappedCampaigns);
        setConnections(connectionsData);
        if (connectionsData.length > 0) {
          // Auto-select if there is only one connection
          if (connectionsData.length === 1) {
            setSelectedConnectionId(connectionsData[0].id);
          } else {
            // Or if there is a connected one, prefer it
            const connected = connectionsData.find(c => c.status === 'connected' || c.status === 'open');
            if (connected) {
              setSelectedConnectionId(connected.id);
            }
          }
        }

        setLists(
          listsData.map((list) => ({
            id: list.id,
            name: list.name,
            contact_count: Number(list.contact_count) || 0,
          }))
        );
        setMessages(
          messagesData.map((message) => ({
            id: message.id,
            name: message.name,
          }))
        );
      } catch (error) {
        toast({
          title: "Erro ao carregar dados",
          description:
            error instanceof Error ? error.message : "Tente novamente mais tarde",
          variant: "destructive",
        });
      } finally {
        setIsLoadingCampaigns(false);
      }
    };

    loadInitialData();
  }, [toast]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<AppSettings>;

      const settings: AppSettings = {
        dailyLimit:
          typeof parsed.dailyLimit === "number" && Number.isFinite(parsed.dailyLimit)
            ? parsed.dailyLimit
            : null,
        minPauseSeconds:
          typeof parsed.minPauseSeconds === "number" &&
          Number.isFinite(parsed.minPauseSeconds)
            ? parsed.minPauseSeconds
            : null,
        maxPauseSeconds:
          typeof parsed.maxPauseSeconds === "number" &&
          Number.isFinite(parsed.maxPauseSeconds)
            ? parsed.maxPauseSeconds
            : null,
      };

      setAppSettings(settings);
    } catch {
      // ignore
    }
  }, []);

  const formatTimeForInput = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast({
        title: "Informe o nome da campanha",
        variant: "destructive",
      });
      return;
    }

    if (!selectedConnectionId || !selectedListId || (selectedMessageIds.length === 0 && !selectedMessageId)) {
      toast({
        title: "Selecione conexão, lista e mensagem",
        variant: "destructive",
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Informe data de início e fim",
        variant: "destructive",
      });
      return;
    }

    const selectedList = lists.find((list) => list.id === selectedListId);
    const contactCount = selectedList?.contact_count ?? 0;

    if (contactCount <= 0) {
      toast({
        title: "A lista selecionada não possui contatos",
        variant: "destructive",
      });
      return;
    }

    if (appSettings?.dailyLimit && contactCount > appSettings.dailyLimit) {
      toast({
        title: "Limite diário de mensagens excedido",
        description: `A lista selecionada possui ${contactCount} contatos e o limite diário configurado é ${appSettings.dailyLimit}. Ajuste o limite em Configurações ou utilize uma lista menor.`,
        variant: "destructive",
      });
      return;
    }

    const [startHours, startMinutes] = startTime
      .split(":")
      .map((v) => parseInt(v, 10));
    const [endHours, endMinutes] = endTime
      .split(":")
      .map((v) => parseInt(v, 10));

    const startDateTime = new Date(startDate);
    startDateTime.setHours(startHours || 0, startMinutes || 0, 0, 0);

    const endDateTime = new Date(endDate);
    endDateTime.setHours(endHours || 0, endMinutes || 0, 0, 0);

    if (endDateTime <= startDateTime) {
      toast({
        title: "Período inválido",
        description: "A data/hora de fim deve ser maior que a de início.",
        variant: "destructive",
      });
      return;
    }

    let min_delay = parseInt(minDelayInput, 10);
    let max_delay = parseInt(maxDelayInput, 10);

    if (isNaN(min_delay) || min_delay < 1) min_delay = 1;
    if (isNaN(max_delay) || max_delay < 1) max_delay = 5;

    if (appSettings?.minPauseSeconds && appSettings.minPauseSeconds > 0) {
      min_delay = Math.max(min_delay, appSettings.minPauseSeconds);
    }

    if (appSettings?.maxPauseSeconds && appSettings.maxPauseSeconds > 0) {
      max_delay = Math.max(max_delay, appSettings.maxPauseSeconds);
    }

    if (max_delay <= min_delay) {
      max_delay = min_delay + 1;
    }

    let scheduled_at: string | null = null;
    scheduled_at = startDateTime.toISOString();

    try {
      setIsSubmitting(true);

      const endpoint = editingCampaignId
        ? `/api/campaigns/${editingCampaignId}`
        : "/api/campaigns";

      const method = editingCampaignId ? "PUT" : "POST";

      await api<ApiCampaign>(endpoint, {
        method,
        body: {
          name: campaignName.trim(),
          connection_id: selectedConnectionId,
          list_id: selectedListId,
          message_id: selectedMessageIds.length > 0 ? selectedMessageIds[0] : null,
          message_ids: selectedMessageIds,
          scheduled_at,
          end_at: endDateTime.toISOString(),
          min_delay,
          max_delay,
        },
      });

      toast({
        title: editingCampaignId ? "Campanha atualizada com sucesso" : "Campanha criada com sucesso",
      });

      setCampaignName("");
      setSelectedConnectionId("");
      setSelectedListId("");
      setSelectedMessageId("");
      setSelectedMessageIds([]);
      setStartDate(undefined);
      setEndDate(undefined);
      setStartTime("08:00");
      setEndTime("18:00");
      setMinDelayInput("30");
      setMaxDelayInput("120");
      setEditingCampaignId(null);

      const campaignsData = await api<ApiCampaign[]>("/api/campaigns");
      const mappedCampaigns = campaignsData.map((campaign) => {
        const sent = Number(campaign.sent_count) || 0;
        const failed = Number(campaign.failed_count) || 0;
        const total = sent + failed;
        const scheduledDate = campaign.scheduled_at || campaign.created_at;
        const scheduledAt = scheduledDate
          ? new Date(scheduledDate).toLocaleString("pt-BR")
          : undefined;

        return {
          id: campaign.id,
          name: campaign.name,
          status: mapStatus(campaign.status),
          listName: campaign.list_name,
          messageName: campaign.message_name,
          totalContacts: total,
          sentMessages: sent,
          scheduledAt,
          connectionId: campaign.connection_id,
          listId: campaign.list_id,
          messageId: campaign.message_id,
          messageIds: campaign.message_ids,
          scheduledAtRaw: campaign.scheduled_at ?? null,
          endAtRaw: campaign.end_at ?? null,
          minDelay: campaign.min_delay ?? null,
          maxDelay: campaign.max_delay ?? null,
        };
      });

      setCampaigns(mappedCampaigns);
      setActiveTab("list");
    } catch (error) {
      toast({
        title: editingCampaignId ? "Erro ao atualizar campanha" : "Erro ao criar campanha",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/campaigns/${id}/export`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Erro ao exportar');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaign-${id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast({ title: "Exportação concluída" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  };

  const handleUpdateCampaignStatus = async (
    campaignId: string,
    status: ApiCampaign["status"]
  ) => {
    try {
      const updated = await api<ApiCampaign>(`/api/campaigns/${campaignId}/status`, {
        method: "PATCH",
        body: { status },
      });

      setCampaigns((prev) =>
        prev.map((campaign) =>
          campaign.id === campaignId
            ? {
                ...campaign,
                status: mapStatus(updated.status),
              }
            : campaign
        )
      );

      toast({
        title:
          status === "paused"
            ? "Campanha pausada com sucesso"
            : status === "running"
            ? "Campanha retomada com sucesso"
            : "Campanha atualizada",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar campanha",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      await api(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });

      setCampaigns((prev) => prev.filter((campaign) => campaign.id !== campaignId));

      if (selectedCampaign === campaignId) {
        setSelectedCampaign(null);
        setActiveTab("list");
      }

      toast({
        title: "Campanha removida com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao remover campanha",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingCampaignId(null);
    setCampaignName("");
    setSelectedConnectionId("");
    setSelectedListId("");
    setSelectedMessageIds([]);
    setStartDate(undefined);
    setEndDate(undefined);
    setStartTime("08:00");
    setEndTime("18:00");
    setMinDelayInput("30");
    setMaxDelayInput("120");
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaignId(campaign.id);
    setCampaignName(campaign.name);
    setSelectedConnectionId(campaign.connectionId);
    setSelectedListId(campaign.listId);
    
    if (campaign.messageIds && campaign.messageIds.length > 0) {
      setSelectedMessageIds(campaign.messageIds);
    } else if (campaign.messageId) {
      setSelectedMessageIds([campaign.messageId]);
    } else {
      setSelectedMessageIds([]);
    }
    
    if (campaign.minDelay) setMinDelayInput(campaign.minDelay.toString());
    if (campaign.maxDelay) setMaxDelayInput(campaign.maxDelay.toString());

    if (campaign.scheduledAtRaw) {
      const start = new Date(campaign.scheduledAtRaw);
      setStartDate(start);
      setStartTime(formatTimeForInput(start));
    }

    if (campaign.endAtRaw) {
      const end = new Date(campaign.endAtRaw);
      setEndDate(end);
      setEndTime(formatTimeForInput(end));
    }

    setActiveTab("create");
  };

  const loadMonitor = async (campaignId: string) => {
    try {
      setIsLoadingMonitor(true);

      const statsResponse = await api<CampaignStatsResponse>(
        `/api/campaigns/${campaignId}/stats`
      );
      const messagesResponse = await api<ApiSendLog[]>(
        `/api/campaigns/${campaignId}/messages`
      );

      const stats = statsResponse.stats;

      setMonitorStats({
        total: Number(stats.total) || 0,
        sent: Number(stats.sent) || 0,
        failed: Number(stats.failed) || 0,
        pending: Number(stats.pending) || 0,
      });

      setLogs(
        messagesResponse.map((log) => ({
          id: log.id,
          campaignId: log.campaign_id,
          contactName: log.contact_name || log.phone,
          phone: log.phone,
          status:
            log.status === "sent" || log.status === "failed" ? log.status : "pending",
          scheduledFor: log.scheduled_for
            ? new Date(log.scheduled_for).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-",
          errorMessage: log.error_message,
          sentAt: log.sent_at
            ? new Date(log.sent_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-",
        }))
      );
    } catch (error) {
      toast({
        title: "Erro ao carregar monitoramento",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMonitor(false);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "error") {
      return (campaign.failedMessages || 0) > 0;
    }
    return campaign.status === statusFilter;
  });

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Campanhas</h1>
            <p className="mt-1 text-muted-foreground">
              Gerencie e acompanhe seus disparos de mensagens
            </p>
          </div>
          <Button variant="gradient" onClick={() => {
            resetForm();
            setActiveTab("create");
          }}>
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="list">Campanhas</TabsTrigger>
            <TabsTrigger value="create">Criar Campanha</TabsTrigger>
            {selectedCampaign && (
              <TabsTrigger value="monitor">Monitorar Envios</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="list" className="space-y-4 mt-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filtrar por status:</span>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="running">Em Execução</SelectItem>
                  <SelectItem value="paused">Pausadas</SelectItem>
                  <SelectItem value="completed">Concluídas</SelectItem>
                  <SelectItem value="error">Com Erros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isLoadingCampaigns && campaigns.length === 0 && (
              <Card className="animate-fade-in shadow-card">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Carregando campanhas...</p>
                </CardContent>
              </Card>
            )}
            {filteredCampaigns.map((campaign, index) => {
              const config = statusConfig[campaign.status];
              const StatusIcon = config.icon;
              const progress =
                campaign.totalContacts > 0
                  ? (campaign.sentMessages / campaign.totalContacts) * 100
                  : 0;

              return (
                <Card
                  key={campaign.id}
                  className="transition-all duration-200 hover:shadow-elevated animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-foreground">
                            {campaign.name}
                          </h3>
                          <Badge className={cn(config.bgColor, config.color, "border-0")}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {campaign.listName || "Lista não informada"}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            {campaign.messageName || "Mensagem não informada"}
                          </span>
                          {campaign.scheduledAt && (
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-4 w-4" />
                              {campaign.scheduledAt}
                            </span>
                          )}
                          {campaign.failedMessages !== undefined && campaign.failedMessages > 0 && (
                             <span className="flex items-center gap-1 text-red-500 font-medium">
                               <AlertCircle className="h-4 w-4" />
                               {campaign.failedMessages} falhas
                             </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-foreground">
                            {campaign.sentMessages}/{campaign.totalContacts}
                          </p>
                          <p className="text-sm text-muted-foreground">mensagens enviadas</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExport(campaign.id)}
                            title="Exportar Lista"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCampaign(campaign.id);
                              setActiveTab("monitor");
                              loadMonitor(campaign.id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            Monitorar
                          </Button>
                          {campaign.status === "running" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleUpdateCampaignStatus(campaign.id, "paused")
                              }
                            >
                              <Pause className="h-4 w-4" />
                              Pausar
                            </Button>
                          )}
                          {campaign.status === "paused" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleUpdateCampaignStatus(campaign.id, "running")
                              }
                            >
                              <Play className="h-4 w-4" />
                              Retomar
                            </Button>
                          )}
                          {campaign.status === "scheduled" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCampaign(campaign)}
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCampaign(campaign.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Apagar
                          </Button>
                        </div>
                      </div>
                    </div>
                    {campaign.status !== "scheduled" && (
                      <div className="mt-4">
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="create" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="animate-fade-in shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" />
                    Nova Campanha
                  </CardTitle>
                  <CardDescription>
                    Configure os detalhes da sua campanha de envio
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaignName">Nome da Campanha</Label>
                    <Input
                      id="campaignName"
                      placeholder="Nome da campanha"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Conexão</Label>
                    <Select
                      value={selectedConnectionId}
                      onValueChange={setSelectedConnectionId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma conexão" />
                      </SelectTrigger>
                      <SelectContent>
                        {connections.length === 0 && (
                          <SelectItem value="none" disabled>
                            Nenhuma conexão disponível
                          </SelectItem>
                        )}
                        {connections.map((connection) => (
                          <SelectItem key={connection.id} value={connection.id}>
                            <div className="flex items-center gap-2">
                              {(connection.status === "connected" || connection.status === "open") && (
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                              )}
                              {connection.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {connections.length === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Nenhuma conexão Evolution configurada para este usuário.{" "}
                        <button
                          type="button"
                          className="underline underline-offset-2 text-primary"
                          onClick={() => navigate("/conexoes")}
                        >
                          Clique aqui para configurar
                        </button>
                        .
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Lista de Contatos</Label>
                    <Select
                      value={selectedListId}
                      onValueChange={setSelectedListId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma lista" />
                      </SelectTrigger>
                      <SelectContent>
                        {lists.length === 0 && (
                          <SelectItem value="none" disabled>
                            Nenhuma lista disponível
                          </SelectItem>
                        )}
                        {lists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({list.contact_count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagens (Selecione uma ou mais)</Label>
                    <div className="border rounded-md p-4 max-h-[200px] overflow-y-auto space-y-2 bg-background">
                      {messages.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhuma mensagem disponível</p>
                      )}
                      {messages.map((message) => (
                        <div key={message.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded">
                          <Checkbox 
                            id={`msg-${message.id}`} 
                            checked={selectedMessageIds.includes(message.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMessageIds((prev) => [...prev, message.id]);
                              } else {
                                setSelectedMessageIds((prev) => prev.filter(id => id !== message.id));
                              }
                            }}
                          />
                          <Label htmlFor={`msg-${message.id}`} className="text-sm font-normal cursor-pointer flex-1">
                            {message.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {selectedMessageIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedMessageIds.length} mensagem(ns) selecionada(s)
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="animate-fade-in shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-primary" />
                    Agendamento
                  </CardTitle>
                  <CardDescription>
                    Configure quando e como os envios serão feitos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Data Fim</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Hora Início</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">Hora Fim</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minDelay">Delay Mínimo (segundos)</Label>
                      <Input
                        id="minDelay"
                        type="number"
                        min="1"
                        value={minDelayInput}
                        onChange={(e) => setMinDelayInput(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxDelay">Delay Máximo (segundos)</Label>
                      <Input
                        id="maxDelay"
                        type="number"
                        min="1"
                        value={maxDelayInput}
                        onChange={(e) => setMaxDelayInput(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg bg-accent/50 p-4">
                    <div className="flex items-start gap-3">
                      <Shuffle className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Envio Aleatório Ativo
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          As mensagens serão enviadas respeitando o horário das {startTime} às {endTime}, 
                          com intervalo aleatório entre {minDelayInput} e {maxDelayInput} segundos.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="gradient"
                    className="w-full"
                    onClick={handleCreateCampaign}
                    disabled={isSubmitting}
                  >
                    <Send className="h-4 w-4" />
                    {isSubmitting ? "Agendando..." : "Agendar Campanha"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="monitor" className="mt-6">
            <Card className="animate-fade-in shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Monitoramento de Envios</CardTitle>
                    <CardDescription>
                      Acompanhe cada mensagem enviada em tempo real
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="bg-success/10 text-success">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Enviadas: {monitorStats.sent}
                    </Badge>
                    <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Falhas: {monitorStats.failed}
                    </Badge>
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      Pendentes: {monitorStats.pending}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contato</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Agendado para</TableHead>
                          <TableHead>Enviado em</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                    {isLoadingMonitor && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-sm text-muted-foreground"
                        >
                          Carregando envios da campanha...
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoadingMonitor &&
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{log.contactName}</TableCell>
                          <TableCell>{log.phone}</TableCell>
                          <TableCell>
                            {log.status === "sent" && (
                              <Badge className="bg-success/10 text-success border-0">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Enviada
                              </Badge>
                            )}
                            {log.status === "failed" && (
                              <Badge className="bg-destructive/10 text-destructive border-0">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Falha
                              </Badge>
                            )}
                            {log.status === "pending" && (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{log.scheduledFor}</TableCell>
                          <TableCell>{log.sentAt}</TableCell>
                          <TableCell>
                            {log.errorMessage && log.status === "failed"
                              ? log.errorMessage
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      </TableBody>
                    </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Campanhas;
