import "./library.css";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button, ScrollSurface } from "../../components/ui/Controls";
import { passageLocation, type SourceSnapshot } from "./types";
export function SourceDialog({ source, onClose }: { source: SourceSnapshot | null; onClose(): void }) {
  return <Dialog.Root open={source !== null} onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Backdrop className="void-dialog-backdrop" /><Dialog.Popup className="mind-mini-panel library-source-dialog">
    <div className="mind-mini-panel__heading"><Dialog.Title>{source?.title}</Dialog.Title><Dialog.Close render={<Button aria-label="Close source"><X size={16} /></Button>} /></div>
    <Dialog.Description className="mind-help">Saved source snapshot · {source && passageLocation(source)}</Dialog.Description>
    <ScrollSurface label="Referenced source text" className="library-source-scroll"><p>{source?.text}</p></ScrollSurface>
    <small>{source?.path}</small><small>Snapshot {source?.fingerprint.slice(0,12)}. Original files may have changed since this snapshot was saved.</small>
  </Dialog.Popup></Dialog.Portal></Dialog.Root>;
}
