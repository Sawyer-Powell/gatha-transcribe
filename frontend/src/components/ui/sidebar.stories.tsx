import type { Meta, StoryObj } from '@storybook/react';
import { Sidebar } from './sidebar';

const meta = {
  title: 'UI/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    onVideoSelect: { action: 'video selected' },
    onUpload: { action: 'upload clicked' },
  },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', maxWidth: '320px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleVideos = [
  { id: '1', original_filename: 'Introduction to React.mp4', file_path: 'videos/1.mp4', user_id: 'user1', uploaded_at: '2024-01-10T10:00:00Z' },
  { id: '2', original_filename: 'Advanced TypeScript Patterns.mp4', file_path: 'videos/2.mp4', user_id: 'user1', uploaded_at: '2024-01-10T11:00:00Z' },
  { id: '3', original_filename: 'Zoom Meeting Recording - Project Review.mp4', file_path: 'videos/3.mp4', user_id: 'user1', uploaded_at: '2024-01-10T12:00:00Z' },
  { id: '4', original_filename: 'Team Standup - Monday.mp4', file_path: 'videos/4.mp4', user_id: 'user1', uploaded_at: '2024-01-10T13:00:00Z' },
  { id: '5', original_filename: 'Client Presentation Q1 2024.mp4', file_path: 'videos/5.mp4', user_id: 'user1', uploaded_at: '2024-01-10T14:00:00Z' },
  { id: '6', original_filename: 'Interview with John Doe.mp4', file_path: 'videos/6.mp4', user_id: 'user1', uploaded_at: '2024-01-10T15:00:00Z' },
  { id: '7', original_filename: 'Product Demo - New Features.mp4', file_path: 'videos/7.mp4', user_id: 'user1', uploaded_at: '2024-01-10T16:00:00Z' },
  { id: '8', original_filename: 'Training Session - Security Best Practices.mp4', file_path: 'videos/8.mp4', user_id: 'user1', uploaded_at: '2024-01-10T17:00:00Z' },
];

export const Default: Story = {
  args: {
    userName: 'Sawyer',
    videos: sampleVideos,
  },
};

export const WithSelection: Story = {
  args: {
    userName: 'Sawyer',
    videos: sampleVideos,
    selectedVideoId: '3',
  },
  name: 'With Active Selection',
};

export const FewVideos: Story = {
  args: {
    userName: 'Sawyer',
    videos: [
      { id: '1', original_filename: 'Introduction to React.mp4', file_path: 'videos/1.mp4', user_id: 'user1', uploaded_at: '2024-01-10T10:00:00Z' },
      { id: '2', original_filename: 'Advanced TypeScript Patterns.mp4', file_path: 'videos/2.mp4', user_id: 'user1', uploaded_at: '2024-01-10T11:00:00Z' },
    ],
  },
};

export const NoVideos: Story = {
  args: {
    userName: 'Sawyer',
    videos: [],
  },
};

export const Loading: Story = {
  args: {
    userName: 'Sawyer',
    videos: [],
    isLoading: true,
  },
};

export const Error: Story = {
  args: {
    userName: 'Sawyer',
    videos: [],
    isError: true,
  },
};
