import { create } from "zustand";

/**
 * Verbindet den Deep-Link-Handler in `app/_layout.tsx` mit dem `AuthScreen`.
 *
 * Wenn der Nutzer den Passwort-Reset-Link aus der E-Mail öffnet, tauscht
 * `_layout.tsx` den Code gegen eine Session und setzt `pendingPasswordReset`.
 * `AuthScreen` liest dieses Flag und startet direkt im "reset"-Modus.
 */
interface AuthFlowState {
  pendingPasswordReset: boolean;
  setPendingPasswordReset: (value: boolean) => void;
}

export const useAuthFlowStore = create<AuthFlowState>((set) => ({
  pendingPasswordReset: false,
  setPendingPasswordReset: (value) => set({ pendingPasswordReset: value }),
}));
