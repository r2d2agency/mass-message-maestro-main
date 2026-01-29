import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Type, Image, Video, Mic, Images } from "lucide-react";
import { MessageItemType } from "./MessageItemEditor";

interface AddMessageButtonProps {
  onAdd: (type: MessageItemType) => void;
  onGalleryUpload?: (files: FileList) => void;
}

export function AddMessageButton({ onAdd, onGalleryUpload }: AddMessageButtonProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleGalleryClick = () => {
    galleryInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onGalleryUpload) {
      onGalleryUpload(e.target.files);
    }
    // Reset input
    if (e.target) e.target.value = "";
  };

  return (
    <>
      <input
        type="file"
        ref={galleryInputRef}
        className="hidden"
        multiple
        accept="image/*"
        onChange={handleFileChange}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full border-dashed border-2 h-14 hover:border-primary hover:bg-accent transition-all"
          >
            <Plus className="h-5 w-5 mr-2" />
            Adicionar Mensagem
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          <DropdownMenuItem onClick={() => onAdd("text")} className="cursor-pointer">
            <Type className="h-4 w-4 mr-2 text-blue-500" />
            Texto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAdd("image")} className="cursor-pointer">
            <Image className="h-4 w-4 mr-2 text-green-500" />
            Imagem
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGalleryClick} className="cursor-pointer">
            <Images className="h-4 w-4 mr-2 text-pink-500" />
            Galeria
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAdd("video")} className="cursor-pointer">
            <Video className="h-4 w-4 mr-2 text-purple-500" />
            Vídeo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAdd("audio")} className="cursor-pointer">
            <Mic className="h-4 w-4 mr-2 text-orange-500" />
            Áudio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
