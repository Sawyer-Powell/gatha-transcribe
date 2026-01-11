import * as React from "react";
import Split from "react-split";
import { Video } from "@/components/ui/video";
import { Card } from "@/components/ui/card";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { GripVertical, ChevronLeft, ChevronRight } from "lucide-preact";
import { render } from "preact";
import { useWebSocket } from "@/hooks/useWebSocket";
import { UploadVideoModal } from "@/components/UploadVideoModal";

export interface TranscriberProps {
  videoPath: string;
}

const sampleVideos = [
  { id: '1', title: 'Introduction to React' },
  { id: '2', title: 'Advanced TypeScript Patterns' },
  { id: '3', title: 'Zoom Meeting Recording - Project Review' },
  { id: '4', title: 'Team Standup - Monday' },
  { id: '5', title: 'Client Presentation Q1 2024' },
];

export const Transcriber: React.FC<TranscriberProps> = ({ videoPath }) => {
  const [sidebarVisible, setSidebarVisible] = React.useState(true);
  const [selectedVideoId, setSelectedVideoId] = React.useState<string>('3');
  const [countdown, setCountdown] = React.useState<number>(0);
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);

  // Connect to WebSocket
  const { status } = useWebSocket();

  const handleUploadComplete = (videoId: string) => {
    console.log('Upload complete:', videoId);
    // TODO: Add video to the list and select it
    setUploadModalOpen(false);
  };

  // Update countdown timer for reconnection
  React.useEffect(() => {
    if (status.state === 'waiting-to-reconnect') {
      const interval = setInterval(() => {
        const remaining = status.reconnectAt - Date.now();
        setCountdown(Math.max(0, remaining));
      }, 50); // Update every 50ms for smooth countdown

      return () => clearInterval(interval);
    }
  }, [status]);

  const selectedVideo = sampleVideos.find((v) => v.id === selectedVideoId);

  return (
    <div className="h-screen w-screen flex relative overflow-hidden">
      <div
        className="w-80 flex-shrink-0 border-r border-border transition-transform"
        style={{
          transform: sidebarVisible ? 'translateX(0)' : 'translateX(-288px)',
        }}
      >
        <div
          className="transition-all"
          style={{
            filter: sidebarVisible ? 'none' : 'blur(4px)',
            opacity: sidebarVisible ? 1 : 0.5,
          }}
        >
          <Sidebar
            userName="Sawyer"
            videos={sampleVideos}
            selectedVideoId={selectedVideoId}
            onVideoSelect={setSelectedVideoId}
            onUpload={() => setUploadModalOpen(true)}
          />
        </div>
      </div>

      <Button
        variant="outline"
        onClick={() => setSidebarVisible(!sidebarVisible)}
        className="absolute top-3 z-10 w-8 h-8 -translate-x-2 rounded-full p-0 flex items-center justify-center shadow-lg transition-all"
        style={{ left: sidebarVisible ? '312px' : '24px' }}
      >
        {sidebarVisible ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </Button>

      <div
        className="flex-1 flex flex-col transition-all"
        style={{
          marginLeft: sidebarVisible ? '0' : '-288px',
        }}
      >
        <div className="flex-shrink-0 p-4 border-b border-border flex items-center gap-4">
          {selectedVideo && (
            <h1 className="pl-4 text-lg font-semibold">{selectedVideo.title}</h1>
          )}
        </div>

        <div className="flex-1 p-4">
          <Split
            sizes={[70, 30]}
            minSize={20}
            gutterSize={16}
            className="h-full w-full flex"
            gutter={(_index, direction) => {
              const gutter = document.createElement("div");
              gutter.className =
                "flex items-center justify-center flex-shrink-0 " +
                (direction === "horizontal"
                  ? "cursor-col-resize"
                  : "cursor-row-resize");

              const iconContainer = document.createElement("div");
              if (direction === "horizontal") {
                render(<GripVertical size={16} />, iconContainer);
              }
              gutter.appendChild(iconContainer);

              return gutter;
            }}
          >
            <div className="min-h-full max-h-full p-4 flex flex-col gap-2">
              <div className="relative h-5">
                {/* Connected state */}
                <div
                  className={`absolute inset-0 flex items-center gap-2 transition-opacity duration-300 ${
                    status.state === 'connected' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground">
                    Connected to transcription server
                  </span>
                </div>

                {/* Connecting state */}
                <div
                  className={`absolute inset-0 flex items-center gap-2 transition-opacity duration-300 ${
                    status.state === 'connecting' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="text-xs text-muted-foreground">
                    Connecting...
                  </span>
                </div>

                {/* Waiting to reconnect state */}
                <div
                  className={`absolute inset-0 flex items-center gap-2 transition-opacity duration-300 ${
                    status.state === 'waiting-to-reconnect' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-xs text-muted-foreground">
                    {status.state === 'waiting-to-reconnect' &&
                      `Attempting reconnection in ${(countdown / 1000).toFixed(1)}s (attempt ${status.attempt})`}
                  </span>
                </div>

                {/* Disconnected state */}
                <div
                  className={`absolute inset-0 flex items-center gap-2 transition-opacity duration-300 ${
                    status.state === 'disconnected' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xs text-muted-foreground">
                    Disconnected from server
                  </span>
                </div>
              </div>
              <Card className="mt-2 h-fit w-full overflow-auto">
                <h2 className="text-xl font-semibold mb-4">Transcription</h2>
                <p className="text-sm text-muted-foreground mb-2">
                  This is sample text for the transcription panel. The transcript of
                  the video will appear here.
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                  eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>
                <p className="text-sm text-muted-foreground">
                  Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
                  nisi ut aliquip ex ea commodo consequat.
                </p>
              </Card>
            </div>
            <div className="h-full flex justify-center p-4">
              <Card className="w-full h-fit overflow-auto">
                <Video src={videoPath} className="w-full" />
              </Card>
            </div>
          </Split>
        </div>
      </div>

      <UploadVideoModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
};
