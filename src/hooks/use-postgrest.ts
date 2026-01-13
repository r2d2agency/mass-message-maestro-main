import { useState, useEffect, useCallback } from "react";
import { postgrestApi, PostgrestConfig } from "@/lib/postgrest-api";
import { toast } from "sonner";

export function usePostgrest() {
  const [config, setConfig] = useState<PostgrestConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedConfig = postgrestApi.getConfig();
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, []);

  const saveConfig = useCallback((newConfig: PostgrestConfig) => {
    postgrestApi.saveConfig(newConfig);
    setConfig(newConfig);
    toast.success("Configuração salva!");
  }, []);

  const testConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await postgrestApi.testConnection();
      setIsConnected(result.success);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearConfig = useCallback(() => {
    postgrestApi.clearConfig();
    setConfig(null);
    setIsConnected(false);
    toast.success("Configuração removida!");
  }, []);

  return {
    config,
    isConnected,
    isLoading,
    saveConfig,
    testConnection,
    clearConfig,
  };
}
