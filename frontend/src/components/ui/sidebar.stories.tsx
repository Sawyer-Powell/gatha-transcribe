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
  { id: '1', title: 'Introduction to React' },
  { id: '2', title: 'Advanced TypeScript Patterns' },
  { id: '3', title: 'Zoom Meeting Recording - Project Review' },
  { id: '4', title: 'Team Standup - Monday' },
  { id: '5', title: 'Client Presentation Q1 2024' },
  { id: '6', title: 'Interview with John Doe' },
  { id: '7', title: 'Product Demo - New Features' },
  { id: '8', title: 'Training Session - Security Best Practices' },
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
};

export const FewVideos: Story = {
  args: {
    userName: 'Sawyer',
    videos: [
      { id: '1', title: 'Introduction to React' },
      { id: '2', title: 'Advanced TypeScript Patterns' },
    ],
  },
};

export const NoVideos: Story = {
  args: {
    userName: 'Sawyer',
    videos: [],
  },
};
