import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Shield, Bell, Save } from "lucide-react";

const SETTINGS_STORAGE_KEY = "app_settings";

interface AppSettings {
  darkMode: boolean;
  autoRefresh: boolean;
  notifyCampaignCompleted: boolean;
  notifySendErrors: boolean;
  notifyConnectionLost: boolean;
  dailyLimit: number | null;
  minPauseSeconds: number | null;
  maxPauseSeconds: number | null;
}

const Configuracoes = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notifyCampaignCompleted, setNotifyCampaignCompleted] = useState(true);
  const [notifySendErrors, setNotifySendErrors] = useState(true);
  const [notifyConnectionLost, setNotifyConnectionLost] = useState(true);
  const [dailyLimit, setDailyLimit] = useState("");
  const [minPause, setMinPause] = useState("");
  const [maxPause, setMaxPause] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<AppSettings>;

      if (typeof parsed.darkMode === "boolean") {
        setDarkMode(parsed.darkMode);
      }
      if (typeof parsed.autoRefresh === "boolean") {
        setAutoRefresh(parsed.autoRefresh);
      }
      if (typeof parsed.notifyCampaignCompleted === "boolean") {
        setNotifyCampaignCompleted(parsed.notifyCampaignCompleted);
      }
      if (typeof parsed.notifySendErrors === "boolean") {
        setNotifySendErrors(parsed.notifySendErrors);
      }
      if (typeof parsed.notifyConnectionLost === "boolean") {
        setNotifyConnectionLost(parsed.notifyConnectionLost);
      }
      if (typeof parsed.dailyLimit === "number" && Number.isFinite(parsed.dailyLimit)) {
        setDailyLimit(String(parsed.dailyLimit));
      }
      if (
        typeof parsed.minPauseSeconds === "number" &&
        Number.isFinite(parsed.minPauseSeconds)
      ) {
        setMinPause(String(parsed.minPauseSeconds));
      }
      if (
        typeof parsed.maxPauseSeconds === "number" &&
        Number.isFinite(parsed.maxPauseSeconds)
      ) {
        setMaxPause(String(parsed.maxPauseSeconds));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleSave = () => {
    if (typeof window === "undefined") return;

    const toNumberOrNull = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const n = Number(trimmed);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const settings: AppSettings = {
      darkMode,
      autoRefresh,
      notifyCampaignCompleted,
      notifySendErrors,
      notifyConnectionLost,
      dailyLimit: toNumberOrNull(dailyLimit),
      minPauseSeconds: toNumberOrNull(minPause),
      maxPauseSeconds: toNumberOrNull(maxPause),
    };

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="mt-1 text-muted-foreground">
            Gerencie as configurações do sistema
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* General Settings */}
          <Card className="animate-fade-in shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Configurações Gerais
              </CardTitle>
              <CardDescription>
                Ajustes básicos do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Modo Escuro</Label>
                  <p className="text-sm text-muted-foreground">
                    Ativar tema escuro na interface
                  </p>
                </div>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-refresh</Label>
                  <p className="text-sm text-muted-foreground">
                    Atualizar dados automaticamente
                  </p>
                </div>
                <Switch
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="animate-fade-in shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notificações
              </CardTitle>
              <CardDescription>
                Configure alertas e notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Campanha Concluída</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificar quando uma campanha terminar
                  </p>
                </div>
                <Switch
                  checked={notifyCampaignCompleted}
                  onCheckedChange={setNotifyCampaignCompleted}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Erros de Envio</Label>
                  <p className="text-sm text-muted-foreground">
                    Alertar sobre falhas de entrega
                  </p>
                </div>
                <Switch
                  checked={notifySendErrors}
                  onCheckedChange={setNotifySendErrors}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Conexão Perdida</Label>
                  <p className="text-sm text-muted-foreground">
                    Notificar se a conexão cair
                  </p>
                </div>
                <Switch
                  checked={notifyConnectionLost}
                  onCheckedChange={setNotifyConnectionLost}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="animate-fade-in shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Segurança do WhatsApp
              </CardTitle>
              <CardDescription>
                Proteções para evitar bloqueio da sua conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="maxMessagesDay">Limite diário de mensagens</Label>
                  <Input
                    id="maxMessagesDay"
                    type="number"
                    placeholder="Informe o limite diário"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Máximo de mensagens por dia
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minPause">Pausa mínima (segundos)</Label>
                  <Input
                    id="minPause"
                    type="number"
                    placeholder="Informe a pausa mínima"
                    value={minPause}
                    onChange={(e) => setMinPause(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo entre mensagens
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPause">Pausa máxima (segundos)</Label>
                  <Input
                    id="maxPause"
                    type="number"
                    placeholder="Informe a pausa máxima"
                    value={maxPause}
                    onChange={(e) => setMaxPause(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Máximo entre mensagens
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button variant="gradient" size="lg" onClick={handleSave}>
            <Save className="h-4 w-4" />
            Salvar Todas as Configurações
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default Configuracoes;
