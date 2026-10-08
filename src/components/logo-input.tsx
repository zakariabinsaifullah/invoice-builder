import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Rasterize any image (incl. SVG/WebP) to a compact PNG data URL — the PDF renderer only embeds PNG/JPEG. */
function toPngDataUrl(file: File, maxW = 600, maxH = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || maxW;
      const h = img.naturalHeight || maxH;
      const scale = Math.min(1, maxW / w, maxH / h);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable image"));
    };
    img.src = url;
  });
}

/** Logo picker that stores a compact PNG data URL. */
export function LogoInput({ value, onChange }: { value: string | null; onChange: (logo: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const pick = (file: File | undefined) => {
    setError("");
    if (!file) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) return setError("Use PNG, JPG, SVG or WebP.");
    if (file.size > MAX_LOGO_BYTES) return setError("Max 2 MB.");
    toPngDataUrl(file)
      .then(onChange)
      .catch(() => setError("Couldn't read that image."));
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-border-strong bg-white/[.02] text-muted transition-colors hover:border-accent hover:text-accent"
        aria-label={value ? "Change logo" : "Upload logo"}
      >
        {value ? <img src={value} alt="Logo" className="max-h-12 max-w-20 object-contain" /> : <ImagePlus className="size-5" />}
      </button>
      <div className="min-w-0 text-xs text-muted">
        <div className="font-mono text-text">logo</div>
        {error ? <div className="text-danger">{error}</div> : <div>PNG, JPG, SVG or WebP · max 2 MB</div>}
      </div>
      {value && (
        <Button variant="ghost" size="icon" className="ml-auto" onClick={() => onChange(null)} aria-label="Remove logo">
          <X />
        </Button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
