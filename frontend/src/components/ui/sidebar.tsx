import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, Upload } from "lucide-preact";
import { Button } from "./button";

export interface Video {
  id: string;
  title: string;
}

export interface SidebarProps {
  userName: string;
  videos: Video[];
  onVideoSelect?: (videoId: string) => void;
  onUpload?: () => void;
  selectedVideoId?: string;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  userName,
  videos,
  onVideoSelect,
  onUpload,
  className,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredVideos = videos.filter((video) =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn("flex flex-col h-full gap-4 p-4", className)}>
      <div className="flex-shrink-0">
        <h2 className="text-xl font-semibold mb-1">{userName}</h2>
        <p className="text-sm text-muted-foreground">
          {videos.length} {videos.length === 1 ? "video" : "videos"}
        </p>
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
        {filteredVideos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No videos found
          </p>
        ) : (
          filteredVideos.map((video) => (
            <Button
              variant={"ghost"}
              key={video.id}
              onClick={() => onVideoSelect?.(video.id)}
            >
              <p className="text-sm font-medium truncate">{video.title}</p>
            </Button>
          ))
        )}
      </div>

      <div className="flex-shrink-0">
        <Button
          onClick={onUpload}
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Video
        </Button>
      </div>
    </div>
  );
};
