import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, Upload, LogOut, Loader2, PanelLeftClose } from "lucide-preact";
import { Button } from "./button";
import { useAppLocalStore } from "../../stores/appLocalStore";

export interface Video {
  id: string;
  original_filename: string;
  file_path: string;
  user_id: string;
  uploaded_at: string;
}

export interface SidebarProps {
  userName: string;
  videos: Video[];
  isLoading?: boolean;
  isError?: boolean;
  onVideoSelect?: (videoId: string) => void;
  onUpload?: () => void;
  onLogout?: () => void;
  selectedVideoId?: string;
  className?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  userName,
  videos,
  isLoading = false,
  isError = false,
  onVideoSelect,
  onUpload,
  onLogout,
  selectedVideoId,
  className,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const { user } = useAppLocalStore();

  const filteredVideos = videos.filter((video) =>
    video?.original_filename?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn(
      "flex flex-col h-full gap-4 p-4 transition-opacity duration-300",
      isCollapsed && "opacity-0 pointer-events-none",
      className
    )}>
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">{user?.name ?? userName}</h2>
          <p className="text-sm text-muted-foreground">
            {videos.length} {videos.length === 1 ? "video" : "videos"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="flex-shrink-0 translate-x-3"
        >
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-shrink-0 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search videos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex-1 overflow-auto space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Loading videos...</p>
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive text-center py-4">
            Failed to load videos
          </p>
        ) : filteredVideos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {searchQuery ? "No videos found" : "No videos yet"}
          </p>
        ) : (
          filteredVideos.map((video) => (
            <Button
              variant={"ghost"}
              key={video.id}
              onClick={() => onVideoSelect?.(video.id)}
              active={selectedVideoId === video.id}
              className="w-full justify-start"
            >
              <p className="text-sm font-medium truncate">{video.original_filename}</p>
            </Button>
          ))
        )}
      </div>

      <div className="flex-shrink-0 space-y-2">
        <Button
          onClick={onUpload}
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Video
        </Button>
        <Button
          onClick={onLogout}
          variant="outline"
          className="w-full"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
};
