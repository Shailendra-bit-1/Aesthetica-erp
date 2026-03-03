"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ShortcutOptions {
  onNewPatient?:     () => void;
  onNewAppointment?: () => void;
  onNewInvoice?:     () => void;
  onSearch?:         () => void;
  onClose?:          () => void;
  onSave?:           () => void;
  enabled?:          boolean;
}

/**
 * Global keyboard shortcuts:
 *  N  → New Patient (from /patients page)
 *  B  → New Booking (from /scheduler)
 *  I  → New Invoice (from /billing)
 *  /  → Focus search
 *  Esc → Close active drawer/modal
 *  Ctrl/Cmd + S → Save active form
 *
 * These are only active when `enabled` is true (default) and the user
 * is not focused on an input/textarea/select.
 */
export function useKeyboardShortcuts({
  onNewPatient,
  onNewAppointment,
  onNewInvoice,
  onSearch,
  onClose,
  onSave,
  enabled = true,
}: ShortcutOptions = {}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    function handler(e: KeyboardEvent) {
      const activeEl = document.activeElement;
      const inInput  = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.tagName === "SELECT" ||
        (activeEl as HTMLElement).isContentEditable
      );

      // Ctrl/Cmd + S — save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Escape — close
      if (e.key === "Escape") {
        onClose?.();
        return;
      }

      // / — search (ignore if in input)
      if (e.key === "/" && !inInput) {
        e.preventDefault();
        onSearch?.();
        return;
      }

      // Letter shortcuts — only when NOT in an input
      if (inInput) return;

      switch (e.key.toLowerCase()) {
        case "n": onNewPatient?.();     break;
        case "b": onNewAppointment?.(); break;
        case "i": onNewInvoice?.();     break;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onNewPatient, onNewAppointment, onNewInvoice, onSearch, onClose, onSave, router]);
}
