import * as React from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Rabbit, Volume2, Play, Pause } from "lucide-preact";
import {
  useVideoSessionStore,
  selectConnectionState,
  selectMetadata,
  selectIsReady,
  selectPlaybackSpeed,
  selectVolume,
} from "@/stores/videoSessionStore";

export interface VideoProps extends Omit<React.HTMLAttributes<HTMLVideoElement>, 'src'> {
  videoId?: string;
}

const VideoComponent = React.forwardRef<HTMLVideoElement, VideoProps>(
  ({ className, videoId, ...props }, ref) => {
    // Local UI state (not synced to server)
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [displayTime, setDisplayTime] = React.useState(0); // For smooth slider during seek

    // Subscribe to store state
    const connectionState = useVideoSessionStore(selectConnectionState);
    const metadata = useVideoSessionStore(selectMetadata);
    const isReady = useVideoSessionStore(selectIsReady);
    const playbackSpeed = useVideoSessionStore(selectPlaybackSpeed);
    const volume = useVideoSessionStore(selectVolume);

    // Get store actions
    const initSession = useVideoSessionStore((s) => s.initSession);
    const destroySession = useVideoSessionStore((s) => s.destroySession);
    const notifyVideoCanPlay = useVideoSessionStore((s) => s.notifyVideoCanPlay);
    const notifySeekComplete = useVideoSessionStore((s) => s.notifySeekComplete);
    const updateTime = useVideoSessionStore((s) => s.updateTime);
    const setPlaybackSpeed = useVideoSessionStore((s) => s.setPlaybackSpeed);
    const setVolume = useVideoSessionStore((s) => s.setVolume);

    const internalRef = React.useRef<HTMLVideoElement>(null);
    const videoRef = (ref as React.RefObject<HTMLVideoElement>) || internalRef;
    const isSeeking = React.useRef(false);

    // Derived state
    const duration = metadata?.duration ?? 0;
    const volumePercent = Math.round(volume * 100);

    const handleSpeedChange = (value: number[]) => {
      const speed = value[0];
      if (videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
      // Update store (syncs to server)
      setPlaybackSpeed(speed);
    };

    const handleVolumeChange = (value: number[]) => {
      const vol = value[0];
      if (videoRef.current) {
        videoRef.current.volume = vol / 100;
      }
      // Update store (syncs to server) - store uses 0-1 range
      setVolume(vol / 100);
    };

    const togglePlayPause = () => {
      if (videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
      }
    };

    const handleSeek = (value: number[]) => {
      const time = value[0];
      if (videoRef.current) {
        isSeeking.current = true;
        videoRef.current.currentTime = time;
        setDisplayTime(time);
      }
    };

    const formatTime = (seconds: number) => {
      if (isNaN(seconds)) return "0:00";
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    // Main effect: Initialize session and video element
    React.useEffect(() => {
      if (!videoId) return;

      const video = videoRef.current;
      if (!video) return;

      console.log(`[Video:${videoId.slice(0, 8)}] Effect: initializing`);

      // Reset local UI state
      setIsPlaying(false);
      setDisplayTime(0);

      // Track if we've already notified canplay
      let canPlayNotified = false;

      // Video event handlers
      const handleLoadedMetadata = () => {
        console.log(`[Video:${videoId.slice(0, 8)}] loadedmetadata: duration=${video.duration}`);
        // Duration comes from metadata in store
      };

      const handleCanPlay = () => {
        console.log(`[Video:${videoId.slice(0, 8)}] canplay: readyState=${video.readyState}`);
        if (!canPlayNotified) {
          canPlayNotified = true;
          notifyVideoCanPlay();
        }
      };

      const handleTimeUpdate = () => {
        if (!isSeeking.current) {
          setDisplayTime(video.currentTime);
        }
        // Check store state directly to avoid stale closure
        const state = useVideoSessionStore.getState().state;
        if (state === 'READY' && !video.paused) {
          updateTime(video.currentTime);
        }
      };

      const handleSeeked = () => {
        console.log(`[Video:${videoId.slice(0, 8)}] seeked: currentTime=${video.currentTime}`);
        isSeeking.current = false;
        setDisplayTime(video.currentTime);

        const state = useVideoSessionStore.getState().state;
        if (state === 'SEEKING') {
          notifySeekComplete();
        }
        if (state === 'READY') {
          updateTime(video.currentTime);
        }
      };

      const handlePlay = () => {
        console.log(`[Video:${videoId.slice(0, 8)}] play`);
        setIsPlaying(true);
      };

      const handlePause = () => {
        console.log(`[Video:${videoId.slice(0, 8)}] pause`);
        setIsPlaying(false);
        const state = useVideoSessionStore.getState().state;
        if (state === 'READY') {
          updateTime(video.currentTime);
        }
      };

      // Add event listeners
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);

      // Start the session with callbacks
      initSession(videoId, {
        onSeekTo: (seekTo) => {
          console.log(`[Video:${videoId.slice(0, 8)}] Seeking to ${seekTo}`);
          video.currentTime = seekTo;
        },
        onPlaybackSpeedChange: (speed) => {
          console.log(`[Video:${videoId.slice(0, 8)}] Setting playback speed to ${speed}`);
          video.playbackRate = speed;
        },
        onVolumeChange: (vol) => {
          console.log(`[Video:${videoId.slice(0, 8)}] Setting volume to ${vol}`);
          video.volume = vol;
        },
      });

      // Check if video is already ready (cached)
      if (video.readyState >= 3 && !canPlayNotified) {
        console.log(`[Video:${videoId.slice(0, 8)}] Video already ready (readyState=${video.readyState})`);
        canPlayNotified = true;
        notifyVideoCanPlay();
      }

      // Cleanup
      return () => {
        console.log(`[Video:${videoId.slice(0, 8)}] Effect cleanup`);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        destroySession();
      };
    }, [videoId, initSession, destroySession, notifyVideoCanPlay, notifySeekComplete, updateTime]);

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

    // Get aspect ratio from store metadata
    const aspectRatio = metadata?.width && metadata?.height
      ? (metadata.height / metadata.width) * 100
      : 56.25; // Default to 16:9

    return (
      <div className={cn("flex flex-col gap-4 min-w-fit", className)}>
        <div className="relative w-full" style={{ paddingBottom: `${aspectRatio}%` }}>
          {/* Loading skeleton */}
          <div className={cn(
            "absolute inset-0 bg-foreground/10 rounded-2xl flex items-center justify-center transition-opacity duration-300",
            isReady ? "opacity-0 pointer-events-none" : "opacity-100"
          )}>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">
                {connectionState === 'SEEKING' ? 'Seeking...' : 'Loading video...'}
              </p>
            </div>
          </div>

          {/* Video element */}
          <video
            key={videoId}
            ref={videoRef}
            src={streamUrl}
            preload="auto"
            className={cn(
              "absolute inset-0 w-full h-full rounded-2xl transition-opacity duration-300",
              isReady ? "opacity-100" : "opacity-0"
            )}
            {...props}
          />
        </div>

        <div className="flex flex-col gap-3">
          {/* Seek slider */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground min-w-14 text-right pt-1">
              {formatTime(displayTime)}
            </span>
            <Slider
              value={[displayTime]}
              onValueChange={handleSeek}
              min={0}
              max={duration || 100}
              step={0.1}
              className="flex-1"
            />
            <span className="text-sm font-medium text-muted-foreground min-w-14 pt-1">
              {formatTime(duration)}
            </span>
          </div>

          {/* Controls */}
          <div className="flex gap-4 justify-between items-center">
            <Button
              variant="outline"
              size="lg"
              onClick={togglePlayPause}
              className="flex-shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </Button>

            <div className="flex gap-4 flex-1 justify-end">
              <div className="flex flex-col gap-2 w-50">
                <div className="flex items-center justify-between text-sm">
                  <Volume2 className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{volumePercent}%</span>
                </div>
                <Slider
                  value={[volumePercent]}
                  onValueChange={handleVolumeChange}
                  min={0}
                  max={100}
                  step={10}
                  showSteps
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2 w-30">
                <div className="flex items-center justify-between text-sm">
                  <Rabbit className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{playbackSpeed.toFixed(2)}x</span>
                </div>
                <Slider
                  value={[playbackSpeed]}
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
