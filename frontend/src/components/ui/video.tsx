import * as React from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Rabbit, Volume2 } from "lucide-preact";
import { useTranscriptionSync } from "@/hooks/useTranscriptionSync";
import { useTranscriptionStore } from "@/stores/transcriptionStore";

export interface VideoProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'src'> {
  videoId?: string;
}

const VideoComponent = React.forwardRef<HTMLVideoElement, VideoProps>(
  ({ className, videoId, ...props }, ref) => {
    const [playbackRate, setPlaybackRate] = React.useState(1);
    const [volume, setVolume] = React.useState(100);
    const internalRef = React.useRef<HTMLVideoElement>(null);
    const videoRef = (ref as React.RefObject<HTMLVideoElement>) || internalRef;
    const hasInitializedTime = React.useRef(false);

    // Integrate with transcription store and WebSocket
    const { sendPlaybackUpdate, currentTime: storeCurrentTime } = useTranscriptionSync({
      videoId: videoId || '',
      enabled: !!videoId,
    });
    const { setCurrentTime: setStoreCurrentTime } = useTranscriptionStore();

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

    // Initialize video time from store when video loads
    React.useEffect(() => {
      const video = videoRef.current;
      if (!video || !videoId) return;

      const handleCanPlay = () => {
        // Set video current time from store on first load
        // Wait for canplay event to ensure enough data is loaded for seeking
        if (!hasInitializedTime.current && storeCurrentTime > 0) {
          console.log(`Seeking to saved position: ${storeCurrentTime}s`);
          video.currentTime = storeCurrentTime;
          hasInitializedTime.current = true;
        }
      };

      video.addEventListener('canplay', handleCanPlay);
      return () => video.removeEventListener('canplay', handleCanPlay);
    }, [videoId, storeCurrentTime]);

    // Sync playback position to store (optimistic update)
    React.useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      // Throttle server updates to every 2 seconds during playback
      let lastServerUpdate = 0;
      const SERVER_UPDATE_INTERVAL = 2000; // 2 seconds

      const handleTimeUpdate = () => {
        // Always update local store immediately (optimistic)
        setStoreCurrentTime(video.currentTime);

        // Send throttled updates to server during playback
        const now = Date.now();
        if (!video.paused && now - lastServerUpdate > SERVER_UPDATE_INTERVAL) {
          sendPlaybackUpdate(video.currentTime);
          lastServerUpdate = now;
        }
      };

      // Send immediate update to server when user seeks
      const handleSeeked = () => {
        sendPlaybackUpdate(video.currentTime);
        lastServerUpdate = Date.now(); // Reset throttle timer
      };

      // Send immediate update when playback starts
      const handlePlay = () => {
        sendPlaybackUpdate(video.currentTime);
        lastServerUpdate = Date.now(); // Reset throttle timer
      };

      // Send immediate update when paused
      const handlePause = () => {
        sendPlaybackUpdate(video.currentTime);
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
      };
    }, [sendPlaybackUpdate, setStoreCurrentTime]);

    // Reset initialization flag when video changes
    React.useEffect(() => {
      hasInitializedTime.current = false;
    }, [videoId]);

    const streamUrl = videoId
      ? `http://localhost:3000/api/videos/${videoId}/stream`
      : undefined;

    // Show placeholder if no video selected
    if (!videoId || !streamUrl) {
      return (
        <div className={cn("flex items-center justify-center bg-muted rounded-lg h-96", className)}>
          <p className="text-muted-foreground">No video selected</p>
        </div>
      );
    }

    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <video
          key={videoId}
          ref={videoRef}
          src={streamUrl}
          controls
          preload="auto"
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

VideoComponent.displayName = "VideoComponent";

// Wrap in React.memo to prevent unnecessary rerenders
// Only rerender when videoId changes
const Video = React.memo(VideoComponent, (prevProps, nextProps) => {
  return prevProps.videoId === nextProps.videoId;
});

Video.displayName = "Video";

export { Video };
