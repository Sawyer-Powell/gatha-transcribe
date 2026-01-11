import { useQuery } from '@tanstack/react-query';
import client from '@/api/client';

export interface Video {
  id: string;
  original_filename: string;
  file_path: string;
  user_id: string;
  uploaded_at: string;
}

export const useVideos = () => {
  return useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const response = await client.GET('/api/videos');

      if (response.error) {
        throw new Error('Failed to fetch videos');
      }

      return response.data as Video[];
    },
  });
};
