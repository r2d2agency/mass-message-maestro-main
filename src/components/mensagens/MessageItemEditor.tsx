import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Type,
  Image,
  Video,
  Mic,
  Trash2,
  GripVertical,
  Variable,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/api";

export type MessageItemType = "text" | "image" | "video" | "audio";

export interface MessageItem {
  id: string;
  type: MessageItemType;
  content: string;
  mediaUrl?: string;
  caption?: string;
}

interface MessageItemEditorProps {
  item: MessageItem;
  index: number;
  onUpdate: (id: string, updates: Partial<MessageItem>) => void;
  onDelete: (id: string) => void;
  insertVariable: (id: string, variable: string) => void;
  dragHandleProps?: any;
}

const typeConfig = {
  text: {
    icon: Type,
    label: "Texto",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  image: {
    icon: Image,
    label: "Imagem",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  video: {
    icon: Video,
    label: "Vídeo",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  audio: {
    icon: Mic,
    label: "Áudio",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
};

export function MessageItemEditor({
  item,
  index,
  onUpdate,
  onDelete,
  insertVariable,
  dragHandleProps,
}: MessageItemEditorProps) {
  const config = typeConfig[item.type];
  const Icon = config.icon;

  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleUploadClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadFile<{ url: string }>("/api/messages/upload", file);
      if (response.url) {
        onUpdate(item.id, { mediaUrl: response.url });
      }
    } catch (error) {
      console.error("Erro ao fazer upload da mídia", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      const recorder = mediaRecorderRef.current;
      const stream = mediaStreamRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioChunksRef.current = [];

        const file = new File([blob], "gravacao.webm", { type: "audio/webm" });

        setIsUploading(true);
        try {
          const response = await uploadFile<{ url: string }>("/api/messages/upload", file);
          if (response.url) {
            onUpdate(item.id, { mediaUrl: response.url });
          }
        } catch (error) {
          console.error("Erro ao enviar áudio gravado", error);
        } finally {
          setIsUploading(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Não foi possível acessar o microfone", error);
    }
  };

  return (
    <div className="group relative rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex items-center gap-2 text-muted-foreground cursor-grab active:cursor-grabbing outline-none"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className={cn("flex items-center gap-2 px-2 py-1 rounded-md", config.bgColor)}>
          <Icon className={cn("h-4 w-4", config.color)} />
          <span className={cn("text-xs font-medium", config.color)}>
            {config.label} {index + 1}
          </span>
        </div>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Content based on type */}
      {item.type === "text" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Mensagem de texto</Label>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => insertVariable(item.id, "nome")}
            >
              <Variable className="h-3 w-3 mr-1" />
              Nome
            </Button>
          </div>
          <Textarea
            placeholder="Digite sua mensagem aqui... Use {{nome}} para personalizar"
            value={item.content}
            onChange={(e) => onUpdate(item.id, { content: e.target.value })}
            className="min-h-[100px] resize-none"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Media Upload */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {item.type === "image" ? "Imagem" : "URL da mídia"}
            </Label>
            <div className="flex gap-2 items-center">
              {item.type !== "image" && (
                <Input
                  placeholder={`URL do ${config.label.toLowerCase()}`}
                  value={item.mediaUrl || ""}
                  onChange={(e) => onUpdate(item.id, { mediaUrl: e.target.value })}
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={
                  item.type === "image"
                    ? "image/*"
                    : item.type === "video"
                    ? "video/*"
                    : item.type === "audio"
                    ? "audio/*"
                    : undefined
                }
                className="hidden"
                onChange={handleFileChange}
              />
              {item.type === "image" ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading
                    ? "Enviando..."
                    : item.mediaUrl
                    ? "Alterar Imagem"
                    : "Carregar Imagem"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {item.type === "audio" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Gravar áudio</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  type="button"
                  onClick={handleToggleRecording}
                  disabled={isUploading}
                >
                  <Mic className="h-4 w-4 mr-1" />
                  {isRecording ? "Parar" : "Gravar"}
                </Button>
                {item.mediaUrl && (
                  <audio controls src={item.mediaUrl} className="h-10" />
                )}
              </div>
            </div>
          )}

          {/* Preview for images */}
          {item.type === "image" && item.mediaUrl && (
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video max-w-[200px]">
              <img
                src={item.mediaUrl}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          )}

          {/* Caption for media */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Legenda (opcional)</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => insertVariable(item.id, "nome")}
              >
                <Variable className="h-3 w-3 mr-1" />
                Nome
              </Button>
            </div>
            <Textarea
              placeholder="Adicione uma legenda..."
              value={item.caption || ""}
              onChange={(e) => onUpdate(item.id, { caption: e.target.value })}
              className="min-h-[60px] resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
