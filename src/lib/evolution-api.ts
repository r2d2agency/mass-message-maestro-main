// Evolution API Service
// Cada cliente configura sua própria URL, token e instância

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

export interface ConnectionState {
  status: "connected" | "disconnected" | "connecting";
  phoneNumber?: string;
  qrCode?: string;
  error?: string;
}

const STORAGE_KEY = "evolution_config";

export const evolutionApi = {
  // Salvar configuração
  saveConfig(config: EvolutionConfig): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  },

  // Carregar configuração
  getConfig(): EvolutionConfig | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  // Limpar configuração
  clearConfig(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  // Verificar status da instância
  async checkInstanceStatus(config: EvolutionConfig): Promise<ConnectionState> {
    try {
      const url = `${config.apiUrl}/instance/connectionState/${config.instanceName}`;
      console.log("Checking status at:", url);

      const response = await fetch(
        url,
        {
          headers: {
            apikey: config.apiKey,
          },
        }
      );

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        console.error("API returned HTML instead of JSON. Check if the URL is correct.");
        throw new Error("A URL da API parece incorreta (retornou HTML). Verifique a porta e o endereço.");
      }

      if (!response.ok) {
        if (response.status === 404) {
           throw new Error("Instância não encontrada (404). Verifique o nome da instância.");
        }
        throw new Error(`Falha ao verificar status: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.instance?.state === "open") {
        return {
          status: "connected",
          phoneNumber: data.instance?.phoneNumber || undefined,
        };
      }

      return { status: "disconnected" };
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      return { 
        status: "disconnected", 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      };
    }
  },

  // Buscar QR Code
  async getQRCode(config: EvolutionConfig): Promise<string | null> {
    try {
      const response = await fetch(
        `${config.apiUrl}/instance/connect/${config.instanceName}`,
        {
          headers: {
            apikey: config.apiKey,
          },
        }
      );

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("A URL da API retornou HTML. Verifique a configuração.");
      }

      if (!response.ok) {
        throw new Error("Falha ao buscar QR Code");
      }

      const data = await response.json();
      return data.base64 || data.qrcode?.base64 || null;
    } catch (error) {
      console.error("Erro ao buscar QR Code:", error);
      return null;
    }
  },

  // Criar instância (se não existir)
  async createInstance(config: EvolutionConfig): Promise<boolean> {
    try {
      const response = await fetch(`${config.apiUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.apiKey,
        },
        body: JSON.stringify({
          instanceName: config.instanceName,
          qrcode: true,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("A URL da API retornou HTML. Verifique a configuração.");
      }

      return response.ok;
    } catch (error) {
      console.error("Erro ao criar instância:", error);
      return false;
    }
  },

  // Desconectar instância
  async disconnect(config: EvolutionConfig): Promise<boolean> {
    try {
      const response = await fetch(
        `${config.apiUrl}/instance/logout/${config.instanceName}`,
        {
          method: "DELETE",
          headers: {
            apikey: config.apiKey,
          },
        }
      );

      return response.ok;
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      return false;
    }
  },

  // Enviar mensagem de texto
  async sendTextMessage(
    config: EvolutionConfig,
    phone: string,
    message: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${config.apiUrl}/message/sendText/${config.instanceName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: config.apiKey,
          },
          body: JSON.stringify({
            number: phone,
            text: message,
            options: {
              delay: 1200,
              presence: "composing",
            },
          }),
        }
      );

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("A URL da API retornou HTML. Verifique a configuração.");
      }

      if (!response.ok) {
        console.error("Erro ao enviar mensagem:", await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      return false;
    }
  },
};
