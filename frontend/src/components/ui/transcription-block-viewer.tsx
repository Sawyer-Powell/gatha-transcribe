import * as React from "react";
import { cn } from "@/lib/utils";
import { TranscriptionBlock } from "./transcription-block";
import { SilenceIndicator } from "./silence-indicator";
import { Button } from "./button";
import { Slider } from "./slider";
import { PauseCircle, PlayCircle, Search, X } from "lucide-preact";

export interface TranscriptionBlockData {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface TranscriptionBlockViewerProps {
  blocks: TranscriptionBlockData[];
  currentTime: number;
  autoScroll?: boolean;
  onAutoScrollChange?: (enabled: boolean) => void;
  onSeek?: (time: number) => void;
  onTextChange?: (blockId: string, text: string) => void;
  className?: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface BlockListItemProps {
  block: TranscriptionBlockData;
  prevBlock: TranscriptionBlockData | null;
  isActive: boolean;
  activeBlockRef: React.RefObject<HTMLDivElement>;
  onSeek?: (time: number) => void;
  onTextChange?: (blockId: string, text: string) => void;
  showSilenceIndicators?: boolean;
}

// Memoized block list item to prevent unnecessary rerenders
const BlockListItemInner: React.FC<BlockListItemProps> = ({
  block,
  prevBlock,
  isActive,
  activeBlockRef,
  onSeek,
  onTextChange,
  showSilenceIndicators = true,
}) => {
  const showSilence = showSilenceIndicators && prevBlock && prevBlock.endTime < block.startTime;

  return (
    <>
      {showSilence && (
        <SilenceIndicator duration={block.startTime - prevBlock.endTime} />
      )}
      <TranscriptionBlock
        ref={isActive ? activeBlockRef : undefined}
        id={block.id}
        startTime={block.startTime}
        endTime={block.endTime}
        text={block.text}
        isActive={isActive}
        onSeek={onSeek}
        onTextChange={onTextChange}
      />
    </>
  );
};

const BlockListItem = React.memo(BlockListItemInner, (prev, next) => {
  return (
    prev.block.id === next.block.id &&
    prev.block.startTime === next.block.startTime &&
    prev.block.endTime === next.block.endTime &&
    prev.block.text === next.block.text &&
    prev.isActive === next.isActive &&
    prev.onSeek === next.onSeek &&
    prev.onTextChange === next.onTextChange &&
    prev.prevBlock?.endTime === next.prevBlock?.endTime &&
    prev.showSilenceIndicators === next.showSilenceIndicators
  );
});

export const TranscriptionBlockViewer: React.FC<TranscriptionBlockViewerProps> = ({
  blocks,
  currentTime,
  autoScroll = true,
  onAutoScrollChange,
  onSeek,
  onTextChange,
  className,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const activeBlockRef = React.useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = React.useState(0);
  const [isUserDragging, setIsUserDragging] = React.useState(false);
  const scrollTimeoutRef = React.useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Filter blocks based on search query
  const filteredBlocks = React.useMemo(() => {
    if (!searchQuery.trim()) return blocks;
    const query = searchQuery.toLowerCase();
    return blocks.filter((block) => block.text.toLowerCase().includes(query));
  }, [blocks, searchQuery]);

  // Find current active block - memoize to avoid recalc on every render
  const activeBlockIndex = React.useMemo(() => {
    return filteredBlocks.findIndex(
      (block) => currentTime >= block.startTime && currentTime < block.endTime
    );
  }, [filteredBlocks, currentTime]);

  // Auto-scroll to keep active block centered (disabled while user is dragging slider)
  React.useEffect(() => {
    if (autoScroll && activeBlockRef.current && containerRef.current && !isUserDragging) {
      // Always scroll to center the active block during autoplay
      activeBlockRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeBlockIndex, autoScroll, isUserDragging]);

  // Update scroll position for slider - use passive event via ref
  const handleScroll = React.useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const maxScroll = scrollHeight - clientHeight;
      const position = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
      setScrollPosition(position);
    }
  }, []);

  // Handle slider change
  const handleSliderChange = React.useCallback((value: number[]) => {
    if (containerRef.current) {
      const { scrollHeight, clientHeight } = containerRef.current;
      const maxScroll = scrollHeight - clientHeight;
      // Convert from inverted slider value (RTL) to scroll position
      containerRef.current.scrollTop = ((100 - value[0]) / 100) * maxScroll;
    }
  }, []);

  // Track when user starts dragging the slider
  const handleSliderPointerDown = React.useCallback(() => {
    setIsUserDragging(true);
    // Clear any pending timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  }, []);

  // Track when user stops dragging the slider
  const handleSliderPointerUp = React.useCallback(() => {
    // Add a small delay before re-enabling auto-scroll
    // This prevents jarring jumps right after releasing
    scrollTimeoutRef.current = window.setTimeout(() => {
      setIsUserDragging(false);
    }, 500);
  }, []);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Get timestamp at current scroll position
  const getTimestampAtScrollPosition = React.useCallback((): number => {
    if (!containerRef.current || blocks.length === 0) return 0;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const maxScroll = scrollHeight - clientHeight;
    const scrollRatio = maxScroll > 0 ? scrollTop / maxScroll : 0;

    const totalDuration = blocks[blocks.length - 1].endTime;
    return scrollRatio * totalDuration;
  }, [blocks]);

  // Stable callback for auto-scroll toggle
  const handleAutoScrollToggle = React.useCallback(() => {
    onAutoScrollChange?.(!autoScroll);
  }, [onAutoScrollChange, autoScroll]);

  return (
    <div className={cn("relative h-full flex gap-4 p-4", className)}>
      {/* Main viewer container with rounded border */}
      <div className="flex-1 relative bg-background rounded-2xl overflow-hidden">
        {/* Controls bar - floating top */}
        <div className="absolute top-1 left-2 right-2 z-20 flex items-center gap-2">
          <Button
            variant={autoScroll ? "default" : "outline"}
            size="sm"
            onClick={handleAutoScrollToggle}
            className="gap-2 flex-shrink-0"
          >
            {autoScroll ? (
              <>
                <PlayCircle className="h-4 w-4" />
                Auto
              </>
            ) : (
              <>
                <PauseCircle className="h-4 w-4" />
                Manual
              </>
            )}
          </Button>
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              placeholder="Search transcription..."
              className="w-full h-8 pl-8 pr-8 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {filteredBlocks.length} / {blocks.length}
            </span>
          )}
        </div>

        {/* Top gradient - fades from background to transparent */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background via-background/80 to-transparent z-10 pointer-events-none" />

        {/* Scrollable content */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto scrollbar-hide px-2 pe-1 py-14"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="space-y-2 max-w-3xl mx-auto">
            {filteredBlocks.map((block, index) => (
              <BlockListItem
                key={block.id}
                block={block}
                prevBlock={index > 0 ? filteredBlocks[index - 1] : null}
                isActive={index === activeBlockIndex}
                activeBlockRef={activeBlockRef}
                onSeek={onSeek}
                onTextChange={onTextChange}
                showSilenceIndicators={!searchQuery}
              />
            ))}
          </div>
        </div>

        {/* Bottom gradient - fades from background to transparent */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background via-background/80 to-transparent z-10 pointer-events-none" />
      </div>

      {/* Right sidebar with full-height scrollbar */}
      <div className="relative h-full group/scrollbar py-4">
        <div
          className="h-full flex items-center justify-center"
          onPointerDown={handleSliderPointerDown}
          onPointerUp={handleSliderPointerUp}
          onPointerLeave={handleSliderPointerUp}
        >
          <Slider
            orientation="vertical"
            value={[100 - scrollPosition]}
            onValueChange={handleSliderChange}
            min={0}
            max={100}
            step={0.1}
          />
        </div>

        {/* Timestamp tooltip on hover - positioned to match slider thumb */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
          style={{ top: `calc(1.625rem + (100% - 3.25rem) * ${scrollPosition / 100})` }}
        >
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/scrollbar:opacity-100 transition-opacity whitespace-nowrap">
            <div className="bg-foreground text-background text-xs font-mono px-2.5 py-1.5 rounded shadow-xl border border-border/20">
              {formatTime(getTimestampAtScrollPosition())}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hide scrollbar utility
const style = document.createElement('style');
style.textContent = `
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;
document.head.appendChild(style);
