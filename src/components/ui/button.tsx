import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent/90",
        secondary: "border border-border bg-surface text-text hover:bg-surface-2 hover:border-border-strong",
        ghost: "text-muted hover:bg-surface-2 hover:text-text",
        danger: "bg-danger/10 text-danger hover:bg-danger/20",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
