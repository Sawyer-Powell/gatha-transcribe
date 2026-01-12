import * as React from "react";
import { Video } from "@/components/ui/video";
import { Card } from "@/components/ui/card";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PanelLeftOpen, Upload, LogOut } from "lucide-preact";
import { UploadVideoModal } from "@/components/UploadVideoModal";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";
import { useVideos } from "@/hooks/useVideos";
import { useAppLocalStore } from "@/stores/appLocalStore";
import { useLocation } from "preact-iso";

export interface TranscriberProps {}

// Default sizes in pixels
const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 200;
const COLLAPSED_SIDEBAR_WIDTH = 48;
const DEFAULT_VIDEO_WIDTH = 650;
const MIN_VIDEO_WIDTH = 550;
const DIVIDER_WIDTH = 6;

export const Transcriber: React.FC<TranscriberProps> = () => {
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // App store for persisted state
  const selectedVideoId = useAppLocalStore((state) => state.selectedVideoId);
  const setSelectedVideoId = useAppLocalStore((state) => state.setSelectedVideoId);
  const isSidebarCollapsed = useAppLocalStore((state) => state.isSidebarCollapsed);
  const setSidebarCollapsed = useAppLocalStore((state) => state.setSidebarCollapsed);
  const logout = useAppLocalStore((state) => state.logout);
  const location = useLocation();

  // Local state for panel widths (pixels) - initialize based on persisted collapsed state
  const [sidebarWidth, setSidebarWidth] = React.useState(
    isSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : DEFAULT_SIDEBAR_WIDTH
  );
  const [videoWidth, setVideoWidth] = React.useState(DEFAULT_VIDEO_WIDTH);
  const [isDragging, setIsDragging] = React.useState<'sidebar' | 'video' | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);

  // Store the expanded width when collapsing
  const expandedWidthRef = React.useRef(
    isSidebarCollapsed ? DEFAULT_SIDEBAR_WIDTH : sidebarWidth
  );

  // Fetch videos from server
  const { data: videos = [], isLoading, isError, refetch } = useVideos();

  const handleUploadComplete = (videoId: string) => {
    console.log('Upload complete:', videoId);
    refetch();
    setSelectedVideoId(videoId);
    setUploadModalOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    location.route('/login');
  };

  const selectedVideo = videos.find((v) => v.id === selectedVideoId);

  // Handle sidebar collapse/expand
  const handleToggleSidebarCollapse = () => {
    if (isSidebarCollapsed) {
      setSidebarWidth(expandedWidthRef.current);
      setSidebarCollapsed(false);
    } else {
      expandedWidthRef.current = sidebarWidth;
      setSidebarWidth(COLLAPSED_SIDEBAR_WIDTH);
      setSidebarCollapsed(true);
    }
  };

  // Handle mouse drag for resizing
  const handleMouseDown = (divider: 'sidebar' | 'video') => (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(divider);
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();

      if (isDragging === 'sidebar') {
        // Don't allow resizing when collapsed - user must click expand button
        if (isSidebarCollapsed) return;

        const newWidth = e.clientX - containerRect.left;
        const clampedWidth = Math.max(
          MIN_SIDEBAR_WIDTH,
          Math.min(newWidth, containerRect.width * 0.4)
        );
        setSidebarWidth(clampedWidth);
        expandedWidthRef.current = clampedWidth;
      } else if (isDragging === 'video') {
        // Video width is distance from right edge
        const newWidth = containerRect.right - e.clientX;
        const maxVideoWidth = containerRect.width - sidebarWidth - 200; // Leave 200px min for transcript
        const clampedWidth = Math.max(
          MIN_VIDEO_WIDTH,
          Math.min(newWidth, maxVideoWidth)
        );
        setVideoWidth(clampedWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, sidebarWidth, isSidebarCollapsed]);

  const HEADER_HEIGHT = 56;
  const PADDING = 16;

  return (
    <div ref={containerRef} className="h-screen w-screen overflow-hidden relative flex">
      {/* Sidebar */}
      <div
        className={`h-full relative flex-shrink-0 ${isDragging ? '' : 'transition-[width] duration-200'}`}
        style={{ width: sidebarWidth }}
      >
        <Sidebar
          userName="Sawyer"
          videos={videos}
          isLoading={isLoading}
          isError={isError}
          selectedVideoId={selectedVideoId ?? undefined}
          onVideoSelect={setSelectedVideoId}
          onUpload={() => setUploadModalOpen(true)}
          onLogout={() => setLogoutModalOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebarCollapse}
        />
        {/* Collapsed sidebar controls */}
        {isSidebarCollapsed && (
          <>
            {/* Expand button - same y position as collapse button in sidebar header */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleSidebarCollapse}
              className="absolute top-5 left-1/2 -translate-x-4 z-10"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </Button>

            {/* Bottom action buttons */}
            <div className="absolute bottom-4 left-1/2 -translate-x-4 flex flex-col gap-2 z-10">
              <Button
                variant="default"
                size="icon"
                onClick={() => setUploadModalOpen(true)}
                className="rounded-full"
              >
                <Upload className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLogoutModalOpen(true)}
                className="rounded-full"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Sidebar Divider */}
      <div
        className="h-full cursor-col-resize flex items-center justify-center hover:bg-secondary/50 transition-colors flex-shrink-0"
        style={{ width: DIVIDER_WIDTH }}
        onMouseDown={handleMouseDown('sidebar')}
      >
        <div className="w-px h-full bg-secondary" />
      </div>

      {/* Transcript - flex-1 absorbs sidebar changes */}
      <div className="h-full relative flex-1 min-w-[200px]">
        <div
          className="h-full flex flex-col overflow-auto"
          style={{ padding: PADDING, paddingTop: HEADER_HEIGHT + PADDING }}
        >
          <Card className="h-fit w-full">
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
      </div>

      {/* Video Divider */}
      <div
        className="h-full cursor-col-resize flex items-center justify-center hover:bg-secondary/50 transition-colors flex-shrink-0"
        style={{ width: DIVIDER_WIDTH }}
        onMouseDown={handleMouseDown('video')}
      >
        <div className="w-px h-full bg-secondary" />
      </div>

      {/* Video - fixed pixel width, stable when sidebar changes */}
      <div
        className="h-full relative flex-shrink-0"
        style={{ width: videoWidth }}
      >
        <div
          className="h-full flex items-start overflow-auto"
          style={{ padding: PADDING, paddingTop: HEADER_HEIGHT + PADDING }}
        >
          <Card className="w-full h-fit">
            <Video videoId={selectedVideoId ?? undefined} className="w-full" />
          </Card>
        </div>
      </div>

      {/* Header - positioned over transcript and video panels */}
      <div
        className={`absolute top-0 right-0 border-b border-secondary flex items-center z-10 bg-background ${isDragging ? '' : 'transition-[left] duration-200'}`}
        style={{
          left: sidebarWidth + DIVIDER_WIDTH,
          height: HEADER_HEIGHT,
          padding: PADDING
        }}
      >
        {selectedVideo && (
          <h1 className="text-lg font-semibold">{selectedVideo.original_filename}</h1>
        )}
      </div>

      <UploadVideoModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUploadComplete={handleUploadComplete}
      />

      {/* Logout Confirmation Modal */}
      <Modal open={logoutModalOpen} onOpenChange={setLogoutModalOpen}>
        <ModalContent showClose={false} className="max-w-sm">
          <ModalHeader>
            <ModalTitle>Confirm Logout</ModalTitle>
            <ModalDescription>
              Are you sure you want to log out?
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setLogoutModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Logout
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
