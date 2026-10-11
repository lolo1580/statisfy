"use client";

import type { ReactNode } from "react";

/**
 * Formulaire lié à une server action, avec confirmation avant envoi.
 * Utilisé pour les actions destructrices (suppression, révocation).
 */
export function ConfirmForm({
  action,
  fields,
  message,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
