import { useMemo } from "react";

type BootIntroProps = {
  visible: boolean;
  onSkip: () => void;
};

export function BootIntro({ visible, onSkip }: BootIntroProps) {
  const cls = useMemo(() => (visible ? "opacity-100" : "pointer-events-none opacity-0"), [visible]);

  return (
    <div className={`absolute inset-0 z-40 flex items-center justify-center bg-[#0b0b0a] transition-opacity duration-500 ${cls}`}>
      <div className="absolute inset-0 intro-scanlines" />
      <div className="absolute inset-0 intro-noise" />

      <div className="relative flex flex-col items-center gap-4">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="h-44 w-44">
          <path
            className="void-logo-path"
            d="M 10 5 L 50 95 L 90 5 L 42 45 L 70 25 L 50 70 L 21.1 5 Z"
          />
        </svg>
        <div className="text-xs tracking-[0.35em] text-[#e8e4da]">VOID</div>
        <button onClick={onSkip} className="border border-[#2a2a25] px-3 py-1 text-xs text-[#9c988f] hover:text-[#e8e4da]">
          Skip Intro
        </button>
      </div>
    </div>
  );
}
