import { createContext, useContext } from "react";
export type Confirm = (message: string) => Promise<boolean>;
export const ConfirmationContext = createContext<Confirm | null>(null);
export function useConfirm() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error("ConfirmationProvider is required.");
  return confirm;
}
