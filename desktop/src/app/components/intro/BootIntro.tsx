import { Button } from "../ui/Controls";
import { useRef } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { VOID_PATH } from "../ui/VoidMark";

type BootIntroProps = {
  visible: boolean;
  onSkip: () => void;
};

export function BootIntro({ visible, onSkip }: BootIntroProps) {
  const skipRef = useRef<HTMLButtonElement>(null);
  if (!visible) return null;

  return (
    <Dialog.Root open={visible} onOpenChange={(open) => { if (!open) onSkip(); }}><Dialog.Portal><Dialog.Popup className="void-intro" initialFocus={skipRef}>
      <Dialog.Title className="sr-only">VOID</Dialog.Title>
      <Dialog.Description className="sr-only">Opening your workspace.</Dialog.Description>

      <div className="intro-content">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="h-44 w-44">
          <path
            className="void-logo-path"
            d={VOID_PATH}
          />
        </svg>
        <div className="intro-wordmark" data-word="VOID">VOID</div>
        <Button ref={skipRef} onClick={onSkip}>
          Skip Intro
        </Button>
      </div>
    </Dialog.Popup></Dialog.Portal></Dialog.Root>
  );
}
