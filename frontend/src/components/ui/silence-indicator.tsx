import * as React from "react";
import { cn } from "@/lib/utils";

export interface SilenceIndicatorProps {
  duration: number;
  className?: string;
}

const formatDuration = (seconds: number): string => {
  if (seconds < 1) {
    return `${Math.round(seconds * 10) / 10}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

export const SilenceIndicator: React.FC<SilenceIndicatorProps> = ({
  duration,
  className,
}) => {
  // Don't show for very short gaps (less than 0.5 seconds)
  if (duration < 0.5) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center py-2",
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
        <div className="h-px flex-1 bg-border/30" style={{ width: '40px' }} />
        <span className="font-mono whitespace-nowrap">
          silence {formatDuration(duration)}
        </span>
        <div className="h-px flex-1 bg-border/30" style={{ width: '40px' }} />
      </div>
    </div>
  );
};
