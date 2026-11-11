import type { SVGProps } from "react";
export const VOID_PATH = "M 10 5 L 50 95 L 90 5 L 42 45 L 70 25 L 50 70 L 21.1 5 Z";
export function VoidMark({ size = 24, width = size, height = size, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return <svg width={width} height={height} viewBox="0 0 100 100" aria-hidden="true" {...props}><path d={VOID_PATH} fill="currentColor" /></svg>;
}
