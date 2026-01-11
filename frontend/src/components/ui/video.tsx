import * as React from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Rabbit, Volume2 } from "lucide-preact";

export interface VideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
}

const Video = React.forwardRef<HTMLVideoElement, VideoProps>(
  ({ className, src, ...props }, ref) => {
    const [playbackRate, setPlaybackRate] = React.useState(1);
    const [volume, setVolume] = React.useState(100);
    const internalRef = React.useRef<HTMLVideoElement>(null);
    const videoRef = (ref as React.RefObject<HTMLVideoElement>) || internalRef;

    const handleSpeedChange = (value: number[]) => {
      const speed = value[0];
      setPlaybackRate(speed);
      if (videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
    };

    const handleVolumeChange = (value: number[]) => {
      const vol = value[0];
      setVolume(vol);
      if (videoRef.current) {
        videoRef.current.volume = vol / 100;
      }
    };

    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <video
          ref={videoRef}
          src={src}
          controls
          preload="metadata"
          className="w-full max-w-full"
          {...props}
        />

        <div className="flex gap-4">
          <div className="flex flex-col gap-2 flex-1 max-w-50">
            <div className="flex items-center justify-between text-sm">
              <Volume2 className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">{volume}%</span>
            </div>
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              min={0}
              max={100}
              step={10}
              showSteps
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-2 flex-1 max-w-30">
            <div className="flex items-center justify-between text-sm">
              <Rabbit className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">{playbackRate.toFixed(2)}x</span>
            </div>
            <Slider
              value={[playbackRate]}
              onValueChange={handleSpeedChange}
              min={0.25}
              max={2}
              step={0.25}
              showSteps
              className="w-full"
            />
          </div>
        </div>
      </div>
    );
  }
);

Video.displayName = "Video";

export { Video };
