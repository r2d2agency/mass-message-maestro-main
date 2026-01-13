// PostgREST API Configuration

export interface PostgrestConfig {
  url: string;
  apiKey?: string;
}

const STORAGE_KEY = "blaster_postgrest_config";

export const postgrestApi = {
  saveConfig(config: PostgrestConfig): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  },

  getConfig(): PostgrestConfig | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  clearConfig(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig();
    if (!config?.url) {
      return { success: false, message: "URL não configurada" };
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(config.url, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        return { success: true, message: "Conexão estabelecida com sucesso!" };
      } else {
        return { success: false, message: `Erro: ${response.status} ${response.statusText}` };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Erro ao conectar" 
      };
    }
  },

  // Generic methods for CRUD operations
  async get<T>(table: string, params?: Record<string, string>): Promise<T[]> {
    const config = this.getConfig();
    if (!config?.url) throw new Error("PostgREST não configurado");

    const url = new URL(`${config.url}/${table}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) throw new Error(`Erro: ${response.statusText}`);
    return response.json();
  },

  async post<T>(table: string, data: Partial<T>): Promise<T> {
    const config = this.getConfig();
    if (!config?.url) throw new Error("PostgREST não configurado");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${config.url}/${table}`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) throw new Error(`Erro: ${response.statusText}`);
    const result = await response.json();
    return Array.isArray(result) ? result[0] : result;
  },

  async patch<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    const config = this.getConfig();
    if (!config?.url) throw new Error("PostgREST não configurado");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${config.url}/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) throw new Error(`Erro: ${response.statusText}`);
    const result = await response.json();
    return Array.isArray(result) ? result[0] : result;
  },

  async delete(table: string, id: string): Promise<void> {
    const config = this.getConfig();
    if (!config?.url) throw new Error("PostgREST não configurado");

    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${config.url}/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers,
    });
    
    if (!response.ok) throw new Error(`Erro: ${response.statusText}`);
  },
};
