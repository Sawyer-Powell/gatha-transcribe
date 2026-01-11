import type { Meta, StoryObj } from '@storybook/react';
import { Video } from './video';

const meta = {
  title: 'UI/Video',
  component: Video,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    videoId: {
      control: 'text',
      description: 'Video ID for streaming',
    },
  },
} satisfies Meta<typeof Video>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoVideo: Story = {
  args: {
    videoId: undefined,
  },
};

export const WithVideoId: Story = {
  args: {
    videoId: 'test-video-123',
  },
};
