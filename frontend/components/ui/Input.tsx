import { InputHTMLAttributes, LabelHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-neutral-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`rounded-md border border-brand-border bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-colors focus:border-brand-red ${
            error ? "border-red-700" : ""
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";

export function FieldLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="text-sm font-medium text-neutral-300" {...props} />;
}
