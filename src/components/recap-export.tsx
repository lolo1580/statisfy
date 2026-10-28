"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/toast";

type Props = {
  /** Paramètres de période (`year=2026&month=10`). */
  query: string;
  periodKey: string;
  periodLabel: string;
};

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Laisse le temps au navigateur de démarrer le téléchargement.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function copyImage(blob: Blob): Promise<boolean> {
  try {
    if (
      typeof ClipboardItem === "undefined" ||
      typeof navigator.clipboard?.write !== "function"
    ) {
      return false;
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Menu d'export du récapitulatif.
 *
 * - deux formats d'image (carré 1:1 et story 9:16) ;
 * - partage direct via la feuille de partage du système : sur mobile,
 *   Instagram apparaît dans les destinations et reçoit l'image prête à publier.
 *   Sur les navigateurs sans partage de fichiers, l'image story est
 *   téléchargée (et copiée si possible) puis Instagram est ouvert.
 */
export function RecapExportMenu({ query, periodKey, periodLabel }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [storyBlob, setStoryBlob] = useState<Blob | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const squareUrl = `/api/wrapped/image?${query}`;
  const storyUrl = `${squareUrl}&format=story`;
  const storyFilename = `statisfy-story-${periodKey}.png`;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Précharge l'image story dès l'ouverture du menu : le partage natif peut
  // alors démarrer immédiatement (préserve l'activation utilisateur, exigée par
  // Safari pour `navigator.share`).
  useEffect(() => {
    if (!open || storyBlob) return;
    let cancelled = false;
    fetch(storyUrl, { credentials: "same-origin" })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!cancelled && blob) setStoryBlob(blob);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, storyBlob, storyUrl]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;

    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : (index - 1 + items.length) % items.length;
    items[next].focus();
  };

  const shareToInstagram = async () => {
    setSharing(true);
    try {
      let blob = storyBlob;
      if (!blob) {
        const response = await fetch(storyUrl, { credentials: "same-origin" });
        if (!response.ok) throw new Error("image");
        blob = await response.blob();
      }
      const file = new File([blob], storyFilename, { type: "image/png" });

      // Voie privilégiée : feuille de partage native (Instagram, etc.).
      if (
        typeof navigator.share === "function" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: t("recap.shareTitle", { period: periodLabel }),
          text: t("recap.shareText"),
        });
        close();
        return;
      }

      // Repli : téléchargement + copie dans le presse-papiers, puis ouverture
      // d'Instagram. `window.open` peut être bloqué après un `await`, d'où le
      // message qui indique quoi faire.
      downloadBlob(blob, storyFilename);
      const copied = await copyImage(blob);
      toast(
        t(
          copied
            ? "recap.shareFallbackCopied"
            : "recap.shareFallbackDownloaded",
        ),
        "info",
      );
      window.open(
        "https://www.instagram.com/",
        "_blank",
        "noopener,noreferrer",
      );
      close();
    } catch (error) {
      // Annulation de la feuille de partage : pas une erreur.
      if ((error as { name?: string } | null)?.name !== "AbortError") {
        toast(t("recap.shareFailed"), "error");
      }
      close();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-1.5 text-sm transition-colors hover:border-accent/40 hover:text-accent"
      >
        {t("recap.export")}
        <span aria-hidden className="text-[10px]">
          ▼
        </span>
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("recap.export")}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-30 mt-1 w-64 max-w-[80vw] overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        >
          <a
            role="menuitem"
            href={squareUrl}
            download={`statisfy-${periodKey}.png`}
            onClick={close}
            className="block px-3 py-2 text-sm transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
          >
            {t("recap.downloadSquare")}
            <span className="block text-xs text-muted">1080 × 1080</span>
          </a>
          <a
            role="menuitem"
            href={storyUrl}
            download={storyFilename}
            onClick={close}
            className="block px-3 py-2 text-sm transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
          >
            {t("recap.downloadStory")}
            <span className="block text-xs text-muted">1080 × 1920</span>
          </a>
          <div className="border-t border-border" role="separator" />
          <button
            role="menuitem"
            type="button"
            disabled={sharing}
            onClick={shareToInstagram}
            className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none disabled:opacity-60"
          >
            {sharing ? t("recap.sharePreparing") : t("recap.shareInstagram")}
            <span className="block text-xs text-muted">
              {t("recap.shareHint")}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
