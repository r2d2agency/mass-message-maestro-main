import { useState, useEffect, type ChangeEvent } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Plug, RefreshCw, QrCode, Power, Smartphone, Unplug } from "lucide-react";
import { api, uploadFile } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { evolutionApi, EvolutionConfig, ConnectionState } from "@/lib/evolution-api";

interface Connection {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  instance_name: string;
  status: string;
  created_at: string;
}

const Conexoes = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // New Connection Form
  const [newName, setNewName] = useState("");
  const [newApiUrl, setNewApiUrl] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");

  // Connection Management (QR/Status)
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: "disconnected" });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testMediaFile, setTestMediaFile] = useState<File | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const { toast } = useToast();

  const loadConnections = async () => {
    try {
      setIsLoading(true);
      const data = await api<Connection[]>("/api/connections");
      setConnections(data);
    } catch (error) {
      toast({
        title: "Erro ao carregar conexões",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handleCreateConnection = async () => {
    if (!newName || !newApiUrl || !newApiKey || !newInstanceName) {
      toast({
        title: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      await api("/api/connections", {
        method: "POST",
        body: {
          name: newName,
          api_url: newApiUrl.replace(/\/$/, ""),
          api_key: newApiKey,
          instance_name: newInstanceName,
        },
      });

      toast({
        title: "Conexão criada com sucesso",
      });

      setIsDialogOpen(false);
      setNewName("");
      setNewApiUrl("");
      setNewApiKey("");
      setNewInstanceName("");
      loadConnections();
    } catch (error) {
      toast({
        title: "Erro ao criar conexão",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta conexão?")) return;

    try {
      await api(`/api/connections/${id}`, { method: "DELETE" });
      toast({ title: "Conexão removida" });
      loadConnections();
    } catch (error) {
      toast({
        title: "Erro ao remover conexão",
        variant: "destructive",
      });
    }
  };

  const getEvolutionConfig = (connection: Connection): EvolutionConfig => ({
    apiUrl: connection.api_url,
    apiKey: connection.api_key,
    instanceName: connection.instance_name,
  });

  const checkStatus = async (connection: Connection) => {
    setIsCheckingStatus(true);
    try {
      const config = getEvolutionConfig(connection);
      const state = await evolutionApi.checkInstanceStatus(config);
      setConnectionState(state);
      
      if (state.status === "connected") {
        setQrCode(null);
        // Update status in local list optimistically
        setConnections(prev => prev.map(c => c.id === connection.id ? { ...c, status: 'connected' } : c));
      } else {
        setConnections(prev => prev.map(c => c.id === connection.id ? { ...c, status: 'disconnected' } : c));
      }

      // Persist status to backend if changed
      if (state.status !== connection.status) {
        try {
           await api(`/api/connections/${connection.id}`, {
             method: 'PATCH',
             body: { status: state.status }
           });
        } catch (err) {
           console.error("Failed to update status in backend", err);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleManage = (connection: Connection) => {
    setSelectedConnection(connection);
    setQrCode(null);
    setConnectionState({ status: "disconnected" }); // Reset state
    setIsManaging(true);
    checkStatus(connection);
  };

  const handleConnect = async () => {
    if (!selectedConnection) return;
    
    setIsCheckingStatus(true);
    try {
      const config = getEvolutionConfig(selectedConnection);
      
      // Create instance if not exists
      await evolutionApi.createInstance(config);

      // Get QR Code
      const qr = await evolutionApi.getQRCode(config);
      if (qr) {
        setQrCode(qr);
        setConnectionState({ status: "disconnected", qrCode: qr });
      } else {
         // Maybe already connected
         const state = await evolutionApi.checkInstanceStatus(config);
         setConnectionState(state);
         if (state.status === "connected") {
           toast({ title: "Já conectado!" });
         }
      }
    } catch (error) {
      toast({ title: "Erro ao conectar", variant: "destructive" });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedConnection) return;
    
    setIsCheckingStatus(true);
    try {
      const config = getEvolutionConfig(selectedConnection);
      await evolutionApi.disconnect(config);
      setConnectionState({ status: "disconnected" });
      setQrCode(null);
      toast({ title: "Desconectado" });
      loadConnections();
    } catch (error) {
      toast({ title: "Erro ao desconectar", variant: "destructive" });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleTestMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setTestMediaFile(file);
  };

  const handleSendTestMessage = async () => {
    if (!selectedConnection) return;

    if (!testPhone.trim()) {
      toast({
        title: "Informe o número de telefone para o teste",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSendingTest(true);

      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      if (testMediaFile) {
        const uploaded = await uploadFile<{ url: string }>("/api/messages/upload", testMediaFile);
        mediaUrl = uploaded.url;
        
        if (testMediaFile.type.startsWith('image/')) mediaType = 'image';
        else if (testMediaFile.type.startsWith('video/')) mediaType = 'video';
        else mediaType = 'document';
      }

      const response = await api<{
        success?: boolean;
        message?: string;
        error?: string;
        details?: string;
      }>(`/api/connections/${selectedConnection.id}/test`, {
        method: "POST",
        body: {
          phone: testPhone.trim(),
          text: testMessage.trim() || undefined,
          mediaUrl,
          mediaType
        },
      });

      if ("error" in response) {
        toast({
          title: response.error || "Erro ao enviar mensagem de teste",
          description: response.details,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: response.message || "Mensagem de teste enviada com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao enviar mensagem de teste",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleRefreshQR = async () => {
    if (!selectedConnection) return;
    setIsCheckingStatus(true);
    try {
      const config = getEvolutionConfig(selectedConnection);
      const qr = await evolutionApi.getQRCode(config);
      if (qr) setQrCode(qr);
    } catch (error) {
      toast({ title: "Erro ao atualizar QR Code", variant: "destructive" });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Conexões</h1>
            <p className="mt-1 text-muted-foreground">
              Gerencie suas conexões com a Evolution API
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="h-4 w-4" />
                Nova Conexão
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Conexão</DialogTitle>
                <DialogDescription>
                  Adicione uma nova instância da Evolution API
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome da Conexão</Label>
                  <Input 
                    placeholder="Ex: WhatsApp Comercial" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL da API</Label>
                  <Input 
                    placeholder="https://api.evolution.com" 
                    value={newApiUrl}
                    onChange={(e) => setNewApiUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key (Global)</Label>
                  <Input 
                    type="password" 
                    placeholder="Sua API Key Global" 
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome da Instância</Label>
                  <Input 
                    placeholder="Ex: instance1" 
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateConnection} disabled={isCreating}>
                  {isCreating ? "Criando..." : "Criar Conexão"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((connection) => (
            <Card key={connection.id} className="animate-fade-in hover:shadow-elevated transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-bold">{connection.name}</CardTitle>
                <Badge variant={connection.status === "connected" ? "default" : "secondary"}>
                  {connection.status === "connected" ? "Conectado" : "Desconectado"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    {connection.instance_name}
                  </p>
                  <p className="truncate text-xs opacity-70">{connection.api_url}</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => handleManage(connection)}>
                  <Plug className="h-4 w-4 mr-2" />
                  Gerenciar
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteConnection(connection.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
          
          {connections.length === 0 && !isLoading && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground bg-accent/10 rounded-lg border border-dashed">
              <Plug className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma conexão encontrada</p>
              <Button variant="link" onClick={() => setIsDialogOpen(true)}>
                Criar sua primeira conexão
              </Button>
            </div>
          )}
        </div>

        {/* Manage Dialog */}
        <Dialog open={isManaging} onOpenChange={setIsManaging}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gerenciar Conexão: {selectedConnection?.name}</DialogTitle>
              <DialogDescription>
                Status e pareamento do WhatsApp
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              {connectionState.status === "connected" ? (
                <div className="w-full space-y-6">
                  <div className="text-center space-y-2">
                    <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                      <Smartphone className="h-12 w-12" />
                    </div>
                    <h3 className="text-lg font-semibold text-green-600">WhatsApp Conectado!</h3>
                    <p className="text-sm text-muted-foreground">
                      {connectionState.phoneNumber && `Número: ${connectionState.phoneNumber}`}
                    </p>
                    <Button variant="destructive" onClick={handleDisconnect} disabled={isCheckingStatus}>
                      <Unplug className="h-4 w-4 mr-2" />
                      Desconectar
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4 space-y-3 text-left w-full">
                    <h4 className="font-semibold text-sm">Enviar mensagem de teste</h4>
                    <div className="space-y-2">
                      <Label htmlFor="testPhone">Telefone de teste (com DDI/DD)</Label>
                      <Input
                        id="testPhone"
                        placeholder="Ex: 5599999999999"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="testMedia">Mídia (opcional)</Label>
                      <Input
                        id="testMedia"
                        type="file"
                        onChange={handleTestMediaChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="testMessage">Mensagem (opcional)</Label>
                      <Input
                        id="testMessage"
                        placeholder="Mensagem de teste para validar a conexão"
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleSendTestMessage}
                      disabled={isSendingTest}
                    >
                      {isSendingTest ? "Enviando teste..." : "Enviar mensagem de teste"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4 w-full">
                  {qrCode ? (
                    <div className="space-y-4">
                      <div className="border p-2 rounded-lg bg-white inline-block">
                        <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="h-48 w-48" />
                      </div>
                      <p className="text-sm text-muted-foreground">Escaneie com seu WhatsApp</p>
                      <Button variant="outline" size="sm" onClick={handleRefreshQR} disabled={isCheckingStatus}>
                        <RefreshCw className={`h-3 w-3 mr-2 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                        Atualizar QR
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                        <QrCode className="h-12 w-12" />
                      </div>
                      <p className="text-muted-foreground">Instância desconectada ou não inicializada</p>
                      <Button onClick={handleConnect} disabled={isCheckingStatus} className="w-full">
                        {isCheckingStatus ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Verificando...
                          </>
                        ) : (
                          <>
                            <Power className="h-4 w-4 mr-2" /> Conectar / Gerar QR
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Conexoes;
