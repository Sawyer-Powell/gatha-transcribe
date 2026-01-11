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
    src: {
      control: 'text',
      description: 'Path to the video file',
    },
  },
} satisfies Meta<typeof Video>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    src: '/Zoom Meeting Recording (1).mp4',
  },
};

export const CustomWidth: Story = {
  args: {
    src: '/Zoom Meeting Recording (1).mp4',
    className: 'max-w-md',
  },
};

export const Muted: Story = {
  args: {
    src: '/Zoom Meeting Recording (1).mp4',
    muted: true,
  },
};

export const Autoplay: Story = {
  args: {
    src: '/Zoom Meeting Recording (1).mp4',
    autoplay: true,
    muted: true,
  },
};
