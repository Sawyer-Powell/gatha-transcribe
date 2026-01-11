import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-white/80 border border-muted text-card-foreground rounded-3xl p-6",
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";

export { Card };
