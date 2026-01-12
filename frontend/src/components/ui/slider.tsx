import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  showSteps?: boolean;
  orientation?: "horizontal" | "vertical";
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value,
      defaultValue = [0],
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      className,
      showSteps = false,
      orientation = "horizontal",
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(
      value?.[0] ?? defaultValue[0]
    );

    const currentValue = value !== undefined ? value[0] : internalValue;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.currentTarget.value);
      setInternalValue(newValue);
      onValueChange?.([newValue]);
    };

    const percentage = ((currentValue - min) / (max - min)) * 100;

    // Calculate step marks
    const stepMarks = React.useMemo(() => {
      if (!showSteps) return [];
      const marks = [];
      for (let i = min; i <= max; i += step) {
        const position = ((i - min) / (max - min)) * 100;
        marks.push({ value: i, position });
      }
      return marks;
    }, [showSteps, min, max, step]);

    const isVertical = orientation === "vertical";

    // For vertical sliders with RTL, we need to invert the fill percentage
    const fillPercentage = isVertical ? (100 - percentage) : percentage;

    const backgroundGradient = isVertical
      ? `linear-gradient(to bottom, #458588 0%, #458588 ${fillPercentage}%, rgba(69, 133, 136, 0.2) ${fillPercentage}%, rgba(69, 133, 136, 0.2) 100%)`
      : `linear-gradient(to right, #458588 0%, #458588 ${percentage}%, rgba(69, 133, 136, 0.2) ${percentage}%, rgba(69, 133, 136, 0.2) 100%)`;

    return (
      <div className={cn("relative", isVertical ? "h-full w-fit" : "w-full")}>
        {showSteps && !isVertical && (
          <div className="absolute inset-0 pointer-events-none flex items-center z-0">
            {stepMarks.map((mark) => (
              <div
                key={mark.value}
                className="absolute w-0.5 h-4 bg-foreground/30 translate-y-[3px]"
                style={{
                  left: `calc(10px + (100% - 20px) * ${mark.position / 100})`,
                  transform: 'translateX(-50%)'
                }}
              />
            ))}
          </div>
        )}
        <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        style={{
          background: backgroundGradient,
          ...(isVertical && {
            writingMode: 'vertical-lr',
            direction: 'rtl',
          })
        }}
        className={cn(
          "slider-input rounded-full appearance-none cursor-pointer relative z-10",
          isVertical ? "h-full w-1.5" : "w-full h-1.5",
          "[&::-webkit-slider-runnable-track]:h-1.5",
          "[&::-webkit-slider-runnable-track]:rounded-full",
          "[&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:w-5",
          "[&::-webkit-slider-thumb]:h-5",
          "[&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:bg-background",
          "[&::-webkit-slider-thumb]:border-2",
          "[&::-webkit-slider-thumb]:border-primary",
          "[&::-webkit-slider-thumb]:shadow-md",
          "[&::-webkit-slider-thumb]:cursor-pointer",
          "[&::-moz-range-track]:h-1.5",
          "[&::-moz-range-track]:rounded-full",
          "[&::-moz-range-track]:bg-primary/20",
          "[&::-moz-range-progress]:h-1.5",
          "[&::-moz-range-progress]:rounded-full",
          "[&::-moz-range-progress]:bg-primary",
          "[&::-moz-range-thumb]:w-5",
          "[&::-moz-range-thumb]:h-5",
          "[&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:bg-background",
          "[&::-moz-range-thumb]:border-2",
          "[&::-moz-range-thumb]:border-primary",
          "[&::-moz-range-thumb]:shadow-md",
          "[&::-moz-range-thumb]:cursor-pointer",
          "[&::-moz-range-thumb]:border-0",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
      />
      </div>
    );
  }
);

Slider.displayName = "Slider";

export { Slider };
