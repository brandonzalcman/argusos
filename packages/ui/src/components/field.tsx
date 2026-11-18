import { CircleAlert } from "lucide-react";
import {
  createContext,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
  useContext,
  useId,
} from "react";
import { cn } from "../lib/cn.js";

interface FieldContextValue {
  readonly controlId: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly disabled: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Ids and state supplied by the nearest Field; null outside a Field. */
export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

export interface FieldProps {
  /** Visible label. In generated forms this comes from the field definition label. */
  readonly label: ReactNode;
  /** Help text shown under the label and announced with the control. */
  readonly description?: ReactNode;
  /** Validation message (e.g. from the Zod schema). Presence marks the control invalid. */
  readonly error?: ReactNode;
  readonly required?: boolean;
  readonly disabled?: boolean;
  /** Visually hide the label while keeping it as the accessible name. */
  readonly hideLabel?: boolean;
  /** Override the generated control id. */
  readonly id?: string;
  readonly className?: string;
  /** One control: Input, Textarea, Select or any element using `useFieldContext`. */
  readonly children: ReactNode;
}

/**
 * Label + control + description + error, wired with matching ids so the label names the control
 * and the description/error are announced. Errors show an icon and text, never colour alone.
 */
export function Field({
  label,
  description,
  error,
  required = false,
  disabled = false,
  hideLabel = false,
  id,
  className,
  children,
}: FieldProps): ReactElement {
  const generatedId = useId();
  const controlId = id ?? `${generatedId}-control`;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <FieldContext.Provider
      value={{ controlId, describedBy, invalid: Boolean(error), required, disabled }}
    >
      <div className={cn("grid gap-1.5", className)} data-disabled={disabled || undefined}>
        <label
          htmlFor={controlId}
          className={cn(
            "text-sm font-medium text-fg",
            disabled && "text-fg-muted",
            hideLabel && "sr-only",
          )}
        >
          {label}
          {required ? (
            <>
              <span aria-hidden="true" className="ms-0.5 text-critical">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          ) : null}
        </label>
        {description ? (
          <p id={descriptionId} className="-mt-0.5 text-sm text-fg-muted">
            {description}
          </p>
        ) : null}
        {children}
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-critical">
            <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/** Shared control chrome used by Input, Textarea and Select triggers. */
export const controlClasses = cn(
  "w-full min-w-0 rounded-sm border border-border-strong bg-surface text-base text-fg shadow-sm",
  "placeholder:text-fg-subtle",
  "transition-[border-color,box-shadow] duration-(--argus-duration-fast) ease-out",
  "hover:border-fg-muted",
  "focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-muted disabled:opacity-70",
  "read-only:bg-surface-sunken",
  "aria-invalid:border-critical aria-invalid:focus-visible:ring-critical/30",
);

function useControlAttributes(props: {
  readonly id?: string | undefined;
  readonly invalid?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly "aria-describedby"?: string | undefined;
}) {
  const field = useFieldContext();
  const describedBy =
    [field?.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  const invalid = props.invalid ?? field?.invalid ?? false;
  return {
    id: props.id ?? field?.controlId,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
    required: props.required ?? field?.required,
    disabled: props.disabled ?? field?.disabled,
  };
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Marks the control invalid when used outside a Field. */
  readonly invalid?: boolean;
  /** Decorative icon inside the start edge (e.g. a search glyph). */
  readonly leadingIcon?: ReactNode;
  /** Use monospace for ids, coordinates and times. */
  readonly mono?: boolean;
  readonly ref?: Ref<HTMLInputElement>;
}

/** Single-line text input. Place inside a Field for its label, description and error. */
export function Input({
  invalid,
  leadingIcon,
  mono = false,
  className,
  id,
  required,
  disabled,
  ref,
  "aria-describedby": ariaDescribedBy,
  ...props
}: InputProps): ReactElement {
  const attributes = useControlAttributes({
    id,
    invalid,
    required,
    disabled,
    "aria-describedby": ariaDescribedBy,
  });
  const input = (
    <input
      ref={ref}
      {...attributes}
      {...props}
      className={cn(
        controlClasses,
        "h-(--argus-control-h) px-(--argus-control-px)",
        leadingIcon ? "ps-8" : undefined,
        mono && "font-mono text-sm",
        className,
      )}
    />
  );
  if (!leadingIcon) {
    return input;
  }
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-fg-subtle [&_svg]:size-4"
      >
        {leadingIcon}
      </span>
      {input}
    </div>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly invalid?: boolean;
  readonly ref?: Ref<HTMLTextAreaElement>;
}

/** Multi-line text input that resizes vertically only. */
export function Textarea({
  invalid,
  className,
  id,
  required,
  disabled,
  rows = 4,
  ref,
  "aria-describedby": ariaDescribedBy,
  ...props
}: TextareaProps): ReactElement {
  const attributes = useControlAttributes({
    id,
    invalid,
    required,
    disabled,
    "aria-describedby": ariaDescribedBy,
  });
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...attributes}
      {...props}
      className={cn(
        controlClasses,
        "min-h-16 resize-y px-(--argus-control-px) py-2 leading-relaxed",
        className,
      )}
    />
  );
}

/** Hook for custom controls that need the Field wiring (used by Select). */
export { useControlAttributes };
