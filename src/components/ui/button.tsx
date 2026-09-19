import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#191314] text-white hover:bg-black font-semibold rounded-full shadow-sm hover:scale-[1.01] transition-all",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full shadow-sm",
        outline:
          "border border-[#191314]/15 bg-white hover:bg-[#f4f4f4] text-[#191314] rounded-full font-semibold transition-all",
        secondary:
          "bg-[#f4f4f4] text-[#191314] hover:bg-stone-200 rounded-full font-semibold transition-all",
        ghost: "hover:bg-[#f4f4f4] hover:text-[#191314] rounded-full transition-all",
        link: "text-[#191314] underline-offset-4 hover:underline",
        sports: "bg-[#191314] text-white hover:bg-black font-semibold rounded-full shadow-sm hover:scale-[1.01] transition-all",
        lime: "bg-[#ecf95a] text-[#191314] hover:bg-[#dbee3b] font-bold rounded-full shadow-sm hover:scale-[1.01] transition-all",
        dark: "bg-[#191314] text-white hover:bg-black font-semibold rounded-full shadow-sm hover:scale-[1.01] transition-all",
        pill: "rounded-full border border-[#191314]/15 bg-[#f4f4f4] hover:bg-stone-200 text-[#191314] font-semibold shadow-sm transition-all",
        success: "bg-emerald-600 text-white hover:bg-emerald-700 rounded-full shadow-sm",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-full px-3.5 text-xs font-semibold",
        lg: "h-12 rounded-full px-8 text-sm font-bold",
        icon: "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
