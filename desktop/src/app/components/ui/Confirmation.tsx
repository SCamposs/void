import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "./Controls";
import { ConfirmationContext, type Confirm } from "./use-confirm";
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<((result: boolean) => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const finish = useCallback((result: boolean) => {
    pending.current?.(result); pending.current = null; setMessage(null);
  }, []);
  const confirm = useCallback<Confirm>((next) => {
    pending.current?.(false);
    setMessage(next);
    return new Promise<boolean>((resolve) => { pending.current = resolve; });
  }, []);
  useEffect(() => () => { pending.current?.(false); }, []);
  return <ConfirmationContext.Provider value={confirm}>{children}
    <AlertDialog.Root open={message !== null} onOpenChange={(open) => { if (!open) finish(false); }}><AlertDialog.Portal><AlertDialog.Backdrop className="void-dialog-backdrop" /><AlertDialog.Popup className="void-confirm-dialog" initialFocus={cancelRef}>
      <AlertDialog.Title>Confirm deletion</AlertDialog.Title><AlertDialog.Description>{message}</AlertDialog.Description>
      <div className="confirm-actions"><Button className="is-secondary" ref={cancelRef} onClick={() => finish(false)}>Cancel</Button><Button className="is-secondary is-danger" onClick={() => finish(true)}>Delete data</Button></div>
    </AlertDialog.Popup></AlertDialog.Portal></AlertDialog.Root>
  </ConfirmationContext.Provider>;
}
