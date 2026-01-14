import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type UiCampaignStatus = "scheduled" | "running" | "completed" | "paused";

interface Campaign {
  id: string;
  name: string;
  status: UiCampaignStatus;
  listName?: string;
  messageName?: string;
  totalContacts: number;
  sentMessages: number;
  scheduledAt?: string;
}

interface SendLog {
  id: string;
  campaignId: string;
  contactName: string;
  phone: string;
  status: "sent" | "failed" | "pending";
  sentAt: string;
}

interface ApiCampaign {
  id: string;
  name: string;
  status: "pending" | "running" | "paused" | "completed" | "cancelled";
  list_name?: string;
  message_name?: string;
  scheduled_at?: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

interface ApiSendLog {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  contact_name: string | null;
  phone: string;
  status: "sent" | "failed" | "pending" | "processing";
  sent_at: string | null;
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
  const [activeTab, setActiveTab] = useState("list");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [selectedMessageId, setSelectedMessageId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [pauseInterval, setPauseInterval] = useState("10");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
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
            scheduledAt,
          };
        });

        setCampaigns(mappedCampaigns);
        setConnections(connectionsData);
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

  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast({
        title: "Informe o nome da campanha",
        variant: "destructive",
      });
      return;
    }

    if (!selectedConnectionId || !selectedListId || !selectedMessageId) {
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

    const totalSeconds =
      (endDateTime.getTime() - startDateTime.getTime()) / 1000;

    const pauseCount =
      contactCount > 1 ? Math.floor((contactCount - 1) / 20) : 0;
    const pauseTotalSeconds = pauseCount * 600;
    const effectiveSeconds = totalSeconds - pauseTotalSeconds;

    if (effectiveSeconds <= contactCount * 10 || effectiveSeconds <= 0) {
      toast({
        title: "Período muito curto",
        description:
          "Amplie o intervalo entre início e fim ou use uma lista com menos contatos.",
        variant: "destructive",
      });
      return;
    }

    const avgInterval = effectiveSeconds / contactCount;
    const min_delay = Math.max(Math.floor(avgInterval * 0.6), 10);
    const max_delay = Math.max(Math.floor(avgInterval * 1.4), min_delay + 5);

    let scheduled_at: string | null = null;
    scheduled_at = startDateTime.toISOString();

    try {
      setIsSubmitting(true);

      await api<ApiCampaign>("/api/campaigns", {
        method: "POST",
        body: {
          name: campaignName.trim(),
          connection_id: selectedConnectionId,
          list_id: selectedListId,
          message_id: selectedMessageId,
          scheduled_at,
          min_delay,
          max_delay,
        },
      });

      toast({
        title: "Campanha criada com sucesso",
      });

      setCampaignName("");
      setSelectedConnectionId("");
      setSelectedListId("");
      setSelectedMessageId("");
      setStartDate(undefined);
      setEndDate(undefined);
      setStartTime("08:00");
      setEndTime("18:00");
      setPauseInterval("10");

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
        };
      });

      setCampaigns(mappedCampaigns);
      setActiveTab("list");
    } catch (error) {
      toast({
        title: "Erro ao criar campanha",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
          <Button variant="gradient" onClick={() => setActiveTab("create")}>
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
            {isLoadingCampaigns && campaigns.length === 0 && (
              <Card className="animate-fade-in shadow-card">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Carregando campanhas...</p>
                </CardContent>
              </Card>
            )}
            {campaigns.map((campaign, index) => {
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
                            <Button variant="outline" size="sm">
                              <Pause className="h-4 w-4" />
                              Pausar
                            </Button>
                          )}
                          {campaign.status === "paused" && (
                            <Button variant="outline" size="sm">
                              <Play className="h-4 w-4" />
                              Retomar
                            </Button>
                          )}
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
                            {connection.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Label>Mensagem</Label>
                    <Select
                      value={selectedMessageId}
                      onValueChange={setSelectedMessageId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma mensagem" />
                      </SelectTrigger>
                      <SelectContent>
                        {messages.length === 0 && (
                          <SelectItem value="none" disabled>
                            Nenhuma mensagem disponível
                          </SelectItem>
                        )}
                        {messages.map((message) => (
                          <SelectItem key={message.id} value={message.id}>
                            {message.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

                  <div className="space-y-2">
                    <Label htmlFor="pauseInterval">Pausa Aleatória (minutos)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="pauseInterval"
                        type="number"
                        min="1"
                        max="60"
                        value={pauseInterval}
                        onChange={(e) => setPauseInterval(e.target.value)}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        min entre mensagens
                      </span>
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
                          As mensagens serão enviadas em horários aleatórios entre{" "}
                          {startTime} e {endTime}, com pausas de até {pauseInterval}{" "}
                          minutos entre cada envio para proteger sua conta.
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
                      <TableHead>Enviado em</TableHead>
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
                          <TableCell>{log.sentAt}</TableCell>
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
