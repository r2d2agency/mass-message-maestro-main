import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, Clock, AlertCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type UiCampaignStatus = "scheduled" | "running" | "completed" | "paused";

interface Campaign {
  id: string;
  name: string;
  status: UiCampaignStatus;
  progress: number;
  totalContacts: number;
  sentMessages: number;
  scheduledDate?: string;
}

interface ApiCampaign {
  id: string;
  name: string;
  status: "pending" | "running" | "paused" | "completed" | "cancelled";
  sent_count: number;
  failed_count: number;
  scheduled_at?: string;
  created_at: string;
}

const statusConfig = {
  scheduled: {
    icon: Calendar,
    label: "Agendada",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  running: {
    icon: Play,
    label: "Em Execução",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  completed: {
    icon: CheckCircle2,
    label: "Concluída",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  paused: {
    icon: AlertCircle,
    label: "Pausada",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
};

export function RecentCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadRecentCampaigns = async () => {
      try {
        setIsLoading(true);
        const data = await api<ApiCampaign[]>("/api/campaigns");

        const mapped = data.slice(0, 3).map((campaign) => {
          const sent = Number(campaign.sent_count) || 0;
          const failed = Number(campaign.failed_count) || 0;
          const total = sent + failed;
          const scheduledDateRaw = campaign.scheduled_at || campaign.created_at;
          const scheduledDate = scheduledDateRaw
            ? new Date(scheduledDateRaw).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined;
          const status: UiCampaignStatus =
            campaign.status === "pending"
              ? "scheduled"
              : campaign.status === "cancelled"
                ? "paused"
                : (campaign.status as UiCampaignStatus);

          return {
            id: campaign.id,
            name: campaign.name,
            status,
            progress: total > 0 ? (sent / total) * 100 : 0,
            totalContacts: total,
            sentMessages: sent,
            scheduledDate,
          };
        });

        setCampaigns(mapped);
      } catch (error) {
        toast({
          title: "Erro ao carregar campanhas recentes",
          description:
            error instanceof Error ? error.message : "Tente novamente mais tarde",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentCampaigns();
  }, [toast]);

  return (
    <div className="rounded-xl bg-card p-6 shadow-card border border-border animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Campanhas Recentes
        </h3>
        <a
          href="/campanhas"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver todas
        </a>
      </div>

      <div className="space-y-4">
        {isLoading && campaigns.length === 0 && (
          <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            Carregando campanhas recentes...
          </div>
        )}
        {campaigns.map((campaign) => {
          const config = statusConfig[campaign.status];
          const StatusIcon = config.icon;

          return (
            <div
              key={campaign.id}
              className="rounded-lg border border-border p-4 transition-all duration-200 hover:bg-muted/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">{campaign.name}</h4>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        config.bgColor,
                        config.color
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </span>
                    {campaign.scheduledDate && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {campaign.scheduledDate}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {campaign.sentMessages}/{campaign.totalContacts}
                  </p>
                  <p className="text-xs text-muted-foreground">mensagens</p>
                </div>
              </div>
              {campaign.status !== "scheduled" && (
                <div className="mt-3">
                  <Progress value={campaign.progress} className="h-2" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
