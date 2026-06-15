import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhotoLightboxProps {
  photos: { id: string; signed_photo_url: string }[];
  initialIndex: number;
  onClose: () => void;
}

export default function PhotoLightbox({ photos, initialIndex, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowLeft") {
        setIndex((current) => (current > 0 ? current - 1 : current));
      }
      if (event.key === "ArrowRight") {
        setIndex((current) => (current < photos.length - 1 ? current + 1 : current));
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, photos.length]);

  const photo = photos.at(index);
  if (photo === undefined) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] max-w-4xl flex-col items-center gap-3"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute -top-2 -right-2 z-10 rounded-full"
          onClick={onClose}
          aria-label="Close gallery"
        >
          <X className="size-4" />
        </Button>

        <img
          src={photo.signed_photo_url}
          alt=""
          className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
        />

        {photos.length > 1 ? (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              disabled={index === 0}
              onClick={() => {
                setIndex((current) => current - 1);
              }}
              aria-label="Previous photo"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-white/90">
              {index + 1} / {photos.length}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              disabled={index === photos.length - 1}
              onClick={() => {
                setIndex((current) => current + 1);
              }}
              aria-label="Next photo"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
