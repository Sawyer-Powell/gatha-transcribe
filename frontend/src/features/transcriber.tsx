import * as React from "react";
import { Video } from "@/components/ui/video";
import type { VideoHandle } from "@/components/ui/video";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PanelLeftOpen, Upload, LogOut, Moon, Sun } from "lucide-preact";
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
import { TranscriptionBlockViewer } from "@/components/ui/transcription-block-viewer";
import type { TranscriptionBlockData } from "@/components/ui/transcription-block-viewer";

// Placeholder transcription blocks (~3 minutes of content)
const PLACEHOLDER_BLOCKS: TranscriptionBlockData[] = [
  {
    id: '1',
    startTime: 0,
    endTime: 12,
    text: "Welcome to this video. Today we're going to explore some interesting concepts that will help you understand the fundamentals.",
  },
  {
    id: '2',
    startTime: 12,
    endTime: 25,
    text: "Let's start by looking at the basic principles. These principles form the foundation of everything we'll discuss throughout this presentation.",
  },
  {
    id: '3',
    startTime: 25,
    endTime: 38,
    text: "The first key concept to understand is how systems interact with each other. This interaction creates patterns that we can observe and analyze.",
  },
  {
    id: '4',
    startTime: 38,
    endTime: 52,
    text: "Moving on to our second point, we need to consider the practical applications. How do these theories translate into real-world scenarios?",
  },
  {
    id: '5',
    startTime: 52,
    endTime: 65,
    text: "Here's an example that illustrates this perfectly. Notice how the different elements work together to create a cohesive result.",
  },
  {
    id: '6',
    startTime: 65,
    endTime: 78,
    text: "Now let's dive deeper into the technical aspects. Understanding the underlying mechanics will give you a much clearer picture.",
  },
  {
    id: '7',
    startTime: 78,
    endTime: 92,
    text: "One common misconception is that this process is straightforward. In reality, there are many nuances that we need to account for.",
  },
  {
    id: '8',
    startTime: 92,
    endTime: 105,
    text: "Let me show you what I mean. When we examine the data more closely, we can see patterns emerging that weren't obvious at first.",
  },
  {
    id: '9',
    startTime: 105,
    endTime: 118,
    text: "This brings us to an important question: how do we optimize for the best results? The answer lies in understanding the trade-offs involved.",
  },
  {
    id: '10',
    startTime: 118,
    endTime: 132,
    text: "Research has shown that the most effective approaches combine multiple strategies. No single solution works in all situations.",
  },
  {
    id: '11',
    startTime: 132,
    endTime: 145,
    text: "Let's take a moment to review what we've covered so far. We discussed the fundamentals, looked at examples, and explored the technical details.",
  },
  {
    id: '12',
    startTime: 145,
    endTime: 158,
    text: "In the next section, we'll apply these concepts to a real project. This hands-on approach will help solidify your understanding.",
  },
  {
    id: '13',
    startTime: 158,
    endTime: 172,
    text: "Before we continue, I want to address some frequently asked questions. These are topics that come up regularly in discussions.",
  },
  {
    id: '14',
    startTime: 172,
    endTime: 185,
    text: "The most common question is about scalability. As your needs grow, how do you ensure the system can handle increased demands?",
  },
  {
    id: '15',
    startTime: 185,
    endTime: 200,
    text: "Thank you for watching this video. I hope you found this information valuable. Don't forget to practice what you've learned today.",
  },
];

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
  const videoRef = React.useRef<VideoHandle>(null);

  // Transcription viewer state
  const [currentTime, setCurrentTime] = React.useState(0);
  const [autoScroll, setAutoScroll] = React.useState(true);

  // App store for persisted state
  const selectedVideoId = useAppLocalStore((state) => state.selectedVideoId);
  const setSelectedVideoId = useAppLocalStore((state) => state.setSelectedVideoId);
  const isSidebarCollapsed = useAppLocalStore((state) => state.isSidebarCollapsed);
  const setSidebarCollapsed = useAppLocalStore((state) => state.setSidebarCollapsed);
  const theme = useAppLocalStore((state) => state.theme);
  const toggleTheme = useAppLocalStore((state) => state.toggleTheme);
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

  // Handle seeking from transcription blocks
  const handleSeek = (time: number) => {
    videoRef.current?.seekTo(time);
  };

  // Handle time updates from video
  const handlePlaybackTimeChange = (time: number) => {
    setCurrentTime(time);
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
          className="h-full"
          style={{ paddingTop: HEADER_HEIGHT }}
        >
          <TranscriptionBlockViewer
            blocks={PLACEHOLDER_BLOCKS}
            currentTime={currentTime}
            autoScroll={autoScroll}
            onAutoScrollChange={setAutoScroll}
            onSeek={handleSeek}
            className="h-full"
          />
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
          <Video
            ref={videoRef}
            videoId={selectedVideoId ?? undefined}
            onPlaybackTimeChange={handlePlaybackTimeChange}
            className="w-full"
          />
        </div>
      </div>

      {/* Header - positioned over transcript and video panels */}
      <div
        className={`absolute top-0 right-0 border-b border-secondary flex items-center justify-between z-10 bg-background ${isDragging ? '' : 'transition-[left] duration-200'}`}
        style={{
          left: sidebarWidth + DIVIDER_WIDTH,
          height: HEADER_HEIGHT,
          padding: PADDING
        }}
      >
        {selectedVideo && (
          <h1 className="text-lg font-semibold">{selectedVideo.original_filename}</h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="ml-auto"
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </Button>
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
