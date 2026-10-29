import { Children, forwardRef, isValidElement, useRef, type ChangeEventHandler, type ComponentPropsWithoutRef, type ReactNode, type RefObject } from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { Input as BaseInput } from "@base-ui/react/input";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Checkbox } from "@base-ui/react/checkbox";
import { Switch } from "@base-ui/react/switch";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { NumberField } from "@base-ui/react/number-field";
import { Collapsible } from "@base-ui/react/collapsible";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { Progress as BaseProgress } from "@base-ui/react/progress";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";

// VOID owns composition and appearance. Base UI owns accessible interaction.
export const Button = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>(function Button({ className = "", ...props }, ref) {
  return <BaseButton ref={ref} className={`void-button ${className}`} {...props} />;
});
export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(function Input({ className = "", ...props }, ref) {
  return <BaseInput ref={ref} className={`void-input ${className}`} {...props} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<"textarea">>(function Textarea({ className = "", ...props }, ref) {
  return <BaseInput render={<textarea ref={ref} {...props} />} className={`void-input void-textarea ${className}`} />;
});
export function FileButton({ children, accept, onChange, className = "" }: { children: ReactNode; accept: string; onChange: ChangeEventHandler<HTMLInputElement>; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <><Button type="button" className={`is-secondary ${className}`} onClick={() => inputRef.current?.click()}>{children}</Button><input ref={inputRef} hidden type="file" accept={accept} onChange={onChange} /></>;
}

type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode };
function optionText(node: ReactNode): string {
  return Children.toArray(node).map((part) => isValidElement<{ children?: ReactNode }>(part) ? optionText(part.props.children) : String(part)).join("");
}
/** Option children are declarative data only; the popup never renders a native select. */
export function Select({ value, onValueChange, children, label, className = "", disabled, id, finalFocus }: {
  value: string | number; onValueChange(value: string): void; children: ReactNode;
  label: string; className?: string; disabled?: boolean; id?: string; finalFocus?: RefObject<HTMLElement | null>;
}) {
  const options = Children.toArray(children).filter(isValidElement<OptionProps>).map((child) => ({
    value: String(child.props.value ?? optionText(child.props.children)), label: optionText(child.props.children), disabled: child.props.disabled,
  }));
  return <BaseSelect.Root value={String(value)} items={options} disabled={disabled || !options.length} onValueChange={(next) => { if (next !== null) onValueChange(next); }}>
    <BaseSelect.Trigger id={id} className={`void-select ${className}`} aria-label={label}>
      <BaseSelect.Value /><BaseSelect.Icon><ChevronDown size={14} aria-hidden="true" /></BaseSelect.Icon>
    </BaseSelect.Trigger>
    <BaseSelect.Portal><BaseSelect.Positioner className="void-select-positioner" sideOffset={6} align="start" alignItemWithTrigger={false}>
      <BaseSelect.Popup className="void-select-popup" finalFocus={finalFocus}><BaseSelect.List>
        {options.map((option) => <BaseSelect.Item className="void-select-option" key={option.value} value={option.value} disabled={option.disabled}>
          <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText><BaseSelect.ItemIndicator><Check size={14} aria-hidden="true" /></BaseSelect.ItemIndicator>
        </BaseSelect.Item>)}
      </BaseSelect.List></BaseSelect.Popup>
    </BaseSelect.Positioner></BaseSelect.Portal>
  </BaseSelect.Root>;
}

type CheckedProps = { checked: boolean; onCheckedChange(value: boolean): void; disabled?: boolean; label?: string; className?: string };
export function CheckControl({ label, className = "", ...props }: CheckedProps) {
  return <Checkbox.Root {...props} aria-label={label} className={`void-check ${className}`}><Checkbox.Indicator><Check size={12} aria-hidden="true" /></Checkbox.Indicator></Checkbox.Root>;
}
export function SwitchControl({ label, ...props }: CheckedProps) {
  return <Switch.Root {...props} aria-label={label} className="void-switch"><Switch.Thumb className="void-switch-thumb" /></Switch.Root>;
}
type NumericProps = { value: number; onValueChange(value: number): void; min?: number | string; max?: number | string; step?: number | string; label: string; disabled?: boolean; className?: string };
export function Slider({ min = 0, max = 100, step = 1, label, className = "", ...props }: NumericProps) {
  return <BaseSlider.Root {...props} min={Number(min)} max={Number(max)} step={Number(step)} className={`void-slider ${className}`}>
    <BaseSlider.Control className="void-slider-control"><BaseSlider.Track className="void-slider-track"><BaseSlider.Indicator className="void-slider-indicator" /><BaseSlider.Thumb className="void-slider-thumb" aria-label={label} /></BaseSlider.Track></BaseSlider.Control>
  </BaseSlider.Root>;
}
export function NumberControl({ min, max, step = 1, label, className = "", onValueChange, ...props }: NumericProps) {
  return <NumberField.Root {...props} min={min === undefined ? undefined : Number(min)} max={max === undefined ? undefined : Number(max)} step={Number(step)} onValueChange={(next) => { if (next !== null) onValueChange(next); }} className={`void-number ${className}`}>
    <NumberField.Group><NumberField.Input aria-label={label} /><NumberField.Decrement aria-label={`Decrease ${label}`}><Minus size={12} /></NumberField.Decrement><NumberField.Increment aria-label={`Increase ${label}`}><Plus size={12} /></NumberField.Increment></NumberField.Group>
  </NumberField.Root>;
}
export function Disclosure({ className = "", ...props }: ComponentPropsWithoutRef<typeof Collapsible.Root>) {
  return <Collapsible.Root className={`void-disclosure ${className}`} {...props} />;
}
export function DisclosureTitle({ className = "", children, ...props }: ComponentPropsWithoutRef<typeof Collapsible.Trigger>) {
  return <Collapsible.Trigger {...props} className={`void-disclosure-trigger ${className}`}>{children}<ChevronDown size={14} aria-hidden="true" /></Collapsible.Trigger>;
}
export function DisclosureBody({ children }: { children: ReactNode }) {
  return <Collapsible.Panel className="void-disclosure-panel">{children}</Collapsible.Panel>;
}
export function ScrollSurface({ children, className = "", label }: { children: ReactNode; className?: string; label: string }) {
  return <ScrollArea.Root className={`void-scroll-area ${className}`}><ScrollArea.Viewport className="void-scroll-viewport" aria-label={label}><ScrollArea.Content>{children}</ScrollArea.Content></ScrollArea.Viewport><ScrollArea.Scrollbar className="void-scrollbar"><ScrollArea.Thumb className="void-scroll-thumb" /></ScrollArea.Scrollbar></ScrollArea.Root>;
}
export function Progress({ value, max = 100, className = "", "aria-label": label }: { value: number | null; max?: number; className?: string; "aria-label": string }) {
  return <BaseProgress.Root value={value === null ? null : max > 0 ? value / max * 100 : 0} aria-label={label} className={`void-progress ${className}`}><BaseProgress.Track><BaseProgress.Indicator /></BaseProgress.Track></BaseProgress.Root>;
}
export function Tooltip({ label, children }: { label: string; children: React.ReactElement }) {
  return <BaseTooltip.Root><BaseTooltip.Trigger render={children} /><BaseTooltip.Portal><BaseTooltip.Positioner sideOffset={8} className="void-tooltip-positioner"><BaseTooltip.Popup className="void-tooltip">{label}</BaseTooltip.Popup></BaseTooltip.Positioner></BaseTooltip.Portal></BaseTooltip.Root>;
}
export const TooltipProvider = BaseTooltip.Provider;
