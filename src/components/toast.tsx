"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue>({
  toast: () => undefined,
});

/** Petit système de notifications global (succès / erreur / info). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    if (!message) return;
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(92vw,360px)] flex-col gap-2"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
              item.tone === "error"
                ? "border-danger/40 bg-danger/15 text-danger"
                : item.tone === "info"
                  ? "border-border bg-surface/95 text-foreground"
                  : "border-accent/40 bg-accent-soft text-accent"
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
