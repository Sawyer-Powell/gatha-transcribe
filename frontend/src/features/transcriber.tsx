import * as React from "react";
import Split from "react-split";
import { Video } from "@/components/ui/video";
import { Card } from "@/components/ui/card";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { GripVertical, ChevronLeft, ChevronRight } from "lucide-preact";
import { render } from "preact";
import { UploadVideoModal } from "@/components/UploadVideoModal";
import { useVideos } from "@/hooks/useVideos";
import { useAppLocalStore } from "@/stores/appLocalStore";

export interface TranscriberProps {}

export const Transcriber: React.FC<TranscriberProps> = () => {
  const [sidebarVisible, setSidebarVisible] = React.useState(true);
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);

  // App store for persisted state
  const selectedVideoId = useAppLocalStore((state) => state.selectedVideoId);
  const setSelectedVideoId = useAppLocalStore((state) => state.setSelectedVideoId);
  const splitSizes = useAppLocalStore((state) => state.splitSizes) || [70, 30];
  const setSplitSizes = useAppLocalStore((state) => state.setSplitSizes);

  // Fetch videos from server
  const { data: videos = [], isLoading, isError, refetch } = useVideos();

  const handleUploadComplete = (videoId: string) => {
    console.log('Upload complete:', videoId);
    // Refetch videos and select the newly uploaded one
    refetch();
    setSelectedVideoId(videoId);
    setUploadModalOpen(false);
  };

  const selectedVideo = videos.find((v) => v.id === selectedVideoId);

  // Handle split size changes
  const handleSplitChange = (sizes: number[]) => {
    if (sizes.length === 2) {
      setSplitSizes([sizes[0], sizes[1]]);
    }
  };

  return (
    <div className="h-screen w-screen flex relative overflow-hidden">
      <div
        className="w-80 flex-shrink-0 border-r border-border transition-transform h-full"
        style={{
          transform: sidebarVisible ? 'translateX(0)' : 'translateX(-288px)',
        }}
      >
        <div
          className="transition-all h-full"
          style={{
            filter: sidebarVisible ? 'none' : 'blur(4px)',
            opacity: sidebarVisible ? 1 : 0.5,
          }}
        >
          <Sidebar
            userName="Sawyer"
            videos={videos}
            isLoading={isLoading}
            isError={isError}
            selectedVideoId={selectedVideoId ?? undefined}
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
            <h1 className="pl-4 text-lg font-semibold">{selectedVideo.original_filename}</h1>
          )}
        </div>

        <div className="flex-1 p-4">
          <Split
            sizes={Array.isArray(splitSizes) ? splitSizes : [70, 30]}
            minSize={20}
            gutterSize={16}
            className="h-full w-full flex"
            onDragEnd={handleSplitChange}
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
              <Card className="h-fit w-full overflow-auto">
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
                <Video videoId={selectedVideoId ?? undefined} className="w-full" />
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
