import { useEffect, useState, type ChangeEvent } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Shield, Bell, Save, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api, uploadFile } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const [darkMode, setDarkMode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notifyCampaignCompleted, setNotifyCampaignCompleted] = useState(true);
  const [notifySendErrors, setNotifySendErrors] = useState(true);
  const [notifyConnectionLost, setNotifyConnectionLost] = useState(true);
  const [dailyLimit, setDailyLimit] = useState("");
  const [minPause, setMinPause] = useState("");
  const [maxPause, setMaxPause] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

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

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const data = await api<{ logoUrl: string | null; faviconUrl: string | null }>(
          "/api/auth/branding",
          { auth: false }
        );
        if (data.logoUrl) {
          setLogoUrl(data.logoUrl);
        }
        if (data.faviconUrl) {
          setFaviconUrl(data.faviconUrl);
        }
      } catch {
      }
    };

    loadBranding();
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

  const handleLogoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setLogoFile(file);
  };

  const handleFaviconFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFaviconFile(file);
  };

  const handleUploadLogo = async () => {
    if (!user || user.role !== "admin") {
      toast({
        title: "Apenas o super admin pode alterar a logo",
        variant: "destructive",
      });
      return;
    }

    if (!logoFile) {
      toast({
        title: "Selecione um arquivo de logo",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSavingBranding(true);
      const uploaded = await uploadFile<{ url: string }>("/api/messages/upload", logoFile);

      await api(`/api/users/${user.id}/branding`, {
        method: "PATCH",
        body: { logoUrl: uploaded.url },
      });

      setLogoUrl(uploaded.url);
      toast({ title: "Logo do sistema atualizada" });
    } catch (error) {
      toast({
        title: "Erro ao enviar logo",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleUploadFavicon = async () => {
    if (!user || user.role !== "admin") {
      toast({
        title: "Apenas o super admin pode alterar o favicon",
        variant: "destructive",
      });
      return;
    }

    if (!faviconFile) {
      toast({
        title: "Selecione um arquivo de favicon",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSavingBranding(true);
      const uploaded = await uploadFile<{ url: string }>("/api/messages/upload", faviconFile);

      await api(`/api/users/${user.id}/branding`, {
        method: "PATCH",
        body: { faviconUrl: uploaded.url },
      });

      setFaviconUrl(uploaded.url);
      toast({ title: "Favicon do sistema atualizado" });
    } catch (error) {
      toast({
        title: "Erro ao enviar favicon",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsSavingBranding(false);
    }
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

          <Card className="animate-fade-in shadow-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                Marca do Sistema
              </CardTitle>
              <CardDescription>
                Logo e favicon configurados pelo super admin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {user?.role !== "admin" ? (
                <p className="text-sm text-muted-foreground">
                  Apenas o super admin pode alterar a identidade visual do sistema.
                </p>
              ) : (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label>Logo do sistema</Label>
                      {logoUrl && (
                        <div className="mb-2 flex items-center gap-3">
                          <img
                            src={logoUrl}
                            alt="Logo atual"
                            className="h-10 w-10 rounded-md border border-border bg-background object-contain"
                          />
                          <span className="text-xs text-muted-foreground break-all">
                            {logoUrl}
                          </span>
                        </div>
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2"
                        onClick={handleUploadLogo}
                        disabled={isSavingBranding}
                      >
                        Enviar logo
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <Label>Favicon</Label>
                      {faviconUrl && (
                        <div className="mb-2 flex items-center gap-3">
                          <img
                            src={faviconUrl}
                            alt="Favicon atual"
                            className="h-6 w-6 rounded-md border border-border bg-background object-contain"
                          />
                          <span className="text-xs text-muted-foreground break-all">
                            {faviconUrl}
                          </span>
                        </div>
                      )}
                      <Input
                        type="file"
                        accept="image/x-icon,image/png,image/jpeg"
                        onChange={handleFaviconFileChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2"
                        onClick={handleUploadFavicon}
                        disabled={isSavingBranding}
                      >
                        Enviar favicon
                      </Button>
                    </div>
                  </div>
                </>
              )}
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
