import type { Meta, StoryObj } from '@storybook/react';
import { Transcriber } from './transcriber';

const meta = {
  title: 'Features/Transcriber',
  component: Transcriber,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    videoPath: {
      control: 'text',
      description: 'Path to the video file',
    },
  },
} satisfies Meta<typeof Transcriber>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    videoPath: '/Zoom Meeting Recording (1).mp4',
  },
};
