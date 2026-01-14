import { MessageItem } from "./MessageItemEditor";
import { Image, Video, Mic } from "lucide-react";

interface MessagePreviewProps {
  items: MessageItem[];
  previewName: string;
}

export function MessagePreview({ items, previewName }: MessagePreviewProps) {
  const replaceVariables = (text: string) => {
    return text.replace(/\{\{nome\}\}/gi, previewName);
  };

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Adicione mensagens para ver o preview...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex justify-end">
          <div className="max-w-[85%] rounded-lg bg-[#dcf8c6] px-3 py-2 shadow-sm">
            {item.type === "image" && (
              <div className="mb-2 rounded overflow-hidden">
                {item.mediaUrl ? (
                  <img
                    src={item.mediaUrl}
                    alt="Preview"
                    className="max-w-full max-h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div className={`flex items-center justify-center h-24 bg-gray-200 ${item.mediaUrl ? "hidden" : ""}`}>
                  <Image className="h-8 w-8 text-gray-400" />
                </div>
              </div>
            )}

            {item.type === "video" && (
              <div className="mb-2 rounded overflow-hidden bg-black">
                {item.mediaUrl ? (
                  <video
                    src={item.mediaUrl}
                    controls
                    className="max-w-full max-h-48"
                  />
                ) : (
                  <div className="flex items-center justify-center h-24 bg-gray-200">
                    <Video className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
            )}

            {item.type === "audio" && (
              <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Mic className="h-4 w-4" />
                </div>
                {item.mediaUrl ? (
                  <audio
                    controls
                    src={item.mediaUrl}
                    className="flex-1 h-8"
                  />
                ) : (
                  <div className="flex-1 h-1 bg-gray-300 rounded-full">
                    <div className="w-1/3 h-full bg-gray-500 rounded-full" />
                  </div>
                )}
                <span className="text-xs text-gray-500">0:00</span>
              </div>
            )}

            {(item.type === "text" ? item.content : item.caption) && (
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {replaceVariables(item.type === "text" ? item.content : item.caption || "")}
              </p>
            )}

            <p className="mt-1 text-right text-[10px] text-gray-500">
              12:00 ✓✓
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
