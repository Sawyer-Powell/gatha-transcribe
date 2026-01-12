import * as React from "react";
import { cn } from "@/lib/utils";
import { Play } from "lucide-preact";
import { Button } from "./button";

export interface TranscriptionBlockProps {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  isActive?: boolean;
  onTextChange?: (blockId: string, text: string) => void;
  onSeek?: (time: number) => void;
  className?: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const TranscriptionBlockInner = React.forwardRef<
  HTMLDivElement,
  TranscriptionBlockProps
>(({ id, startTime, endTime, text, isActive = false, onTextChange, onSeek, className }, ref) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Local text state for responsive editing - only sync on blur
  const [localText, setLocalText] = React.useState(text);
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync from props when not focused (e.g., external updates)
  React.useEffect(() => {
    if (!isFocused) {
      setLocalText(text);
    }
  }, [text, isFocused]);

  // Auto-resize textarea based on content
  const resizeTextarea = React.useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, []);

  // Resize on text change
  React.useEffect(() => {
    resizeTextarea();
  }, [localText, resizeTextarea]);

  // Resize on container width change (e.g., panel resize)
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const observer = new ResizeObserver(() => {
      resizeTextarea();
    });

    observer.observe(textarea);
    return () => observer.disconnect();
  }, [resizeTextarea]);

  const handleChange = (e: Event) => {
    setLocalText((e.target as HTMLTextAreaElement).value);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Only notify parent if text actually changed
    if (localText !== text) {
      onTextChange?.(id, localText);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleSeekClick = React.useCallback(() => {
    onSeek?.(startTime);
  }, [onSeek, startTime]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative rounded-lg border px-3 py-2 transition-all duration-200 group",
        isActive
          ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-md animate-pulse-subtle"
          : "border-border bg-card hover:border-primary/30",
        className
      )}
    >
      {/* Timestamp Header with Play Button */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className={cn(
            "transition-colors",
            isActive ? "text-primary font-semibold" : "text-muted-foreground"
          )}>
            {formatTime(startTime)}
          </span>
          <span className="text-border">→</span>
          <span className={cn(
            "transition-colors",
            isActive ? "text-primary font-semibold" : "text-muted-foreground"
          )}>
            {formatTime(endTime)}
          </span>
        </div>

        {onSeek && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSeekClick}
            className="h-5 w-5"
          >
            <Play className="h-2.5 w-2.5" />
          </Button>
        )}
      </div>

      {/* Editable Transcription Text */}
      <textarea
        ref={textareaRef}
        value={localText}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "w-full resize-none border-0 bg-transparent p-0 overflow-hidden",
          "text-sm leading-relaxed text-card-foreground",
          "focus:outline-none focus:ring-0",
          "placeholder:text-muted-foreground"
        )}
        placeholder="Enter transcription..."
        rows={1}
      />
    </div>
  );
});

TranscriptionBlockInner.displayName = "TranscriptionBlockInner";

// Memoize to prevent rerenders when other blocks change
// Only rerender when this block's props actually change
export const TranscriptionBlock = React.memo(TranscriptionBlockInner, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.startTime === next.startTime &&
    prev.endTime === next.endTime &&
    prev.text === next.text &&
    prev.isActive === next.isActive &&
    prev.onTextChange === next.onTextChange &&
    prev.onSeek === next.onSeek &&
    prev.className === next.className
  );
});

TranscriptionBlock.displayName = "TranscriptionBlock";
