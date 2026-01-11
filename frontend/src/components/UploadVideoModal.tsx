import * as React from "react";
import { Upload, X } from "lucide-preact";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "./ui/modal";
import { Button } from "./ui/button";

interface UploadVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: (videoId: string) => void;
}

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/x-matroska",
];

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const UploadVideoModal: React.FC<UploadVideoModalProps> = ({
  open,
  onOpenChange,
  onUploadComplete,
}) => {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoPreviewRef = React.useRef<HTMLVideoElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      return "Please select a valid video file (MP4, MOV, AVI, WebM, or MKV)";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size must be less than 2GB";
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  // Handle video preview
  React.useEffect(() => {
    if (selectedFile && videoPreviewRef.current) {
      const url = URL.createObjectURL(selectedFile);
      videoPreviewRef.current.src = url;
      videoPreviewRef.current.load();

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [selectedFile]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer?.files) {
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && files[0]) {
        handleFileSelect(files[0]);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("video", selectedFile, selectedFile.name);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          // Cap at 95% to show processing time after upload
          const progress = Math.min((e.loaded / e.total) * 100, 95);
          setUploadProgress(progress);
        }
      });

      // When upload completes, show we're processing
      xhr.upload.addEventListener("loadend", () => {
        setUploadProgress(98);
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Complete the progress bar
          setUploadProgress(100);

          const response = JSON.parse(xhr.responseText);

          // Show success briefly before closing
          setTimeout(() => {
            setIsUploading(false);
            onUploadComplete?.(response.id || "new-video");
            handleCancel();
          }, 500);
        } else {
          throw new Error(`Upload failed with status ${xhr.status}`);
        }
      });

      xhr.addEventListener("error", () => {
        throw new Error("Upload failed. Please try again.");
      });

      // Use absolute URL to backend server
      xhr.open("POST", `${API_BASE_URL}/api/videos/upload`);
      xhr.send(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCancel = () => {
    // Close modal first
    onOpenChange(false);

    // Clear state after animation completes (150ms animation + 50ms buffer)
    setTimeout(() => {
      setSelectedFile(null);
      setError(null);
      setUploadProgress(0);
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }, 200);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        className="max-w-2xl"
        showClose={!selectedFile}
        onInteractOutside={(e) => {
          if (selectedFile) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (selectedFile) {
            e.preventDefault();
          }
        }}
      >
        <ModalHeader>
          <ModalTitle>Upload Video</ModalTitle>
          <ModalDescription>
            {selectedFile
              ? "Preview your video and confirm upload"
              : "Drag and drop a video file or click to browse"}
          </ModalDescription>
        </ModalHeader>

        <div className="py-4">
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                transition-colors duration-200
                ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/5"
                }
              `}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                Drop your video here or click to browse
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Supports MP4, MOV, AVI, WebM, and MKV (max 2GB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_VIDEO_TYPES.join(",")}
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoPreviewRef}
                  controls
                  className="w-full max-h-96"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-accent/10 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                {!isUploading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Uploading...</span>
                    <span className="font-medium">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
            Cancel
          </Button>
          {selectedFile && (
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
