import type { Meta, StoryObj } from '@storybook/react';
import { useState, useEffect } from 'react';
import { TranscriptionBlockViewer, TranscriptionBlockData } from './transcription-block-viewer';

const meta = {
  title: 'UI/TranscriptionBlockViewer',
  component: TranscriptionBlockViewer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TranscriptionBlockViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleBlocks: TranscriptionBlockData[] = [
  {
    id: '1',
    startTime: 0,
    endTime: 15,
    text: "Welcome to this presentation. Today we'll be discussing the fundamentals of modern web development and how it has evolved over the past decade.",
  },
  {
    id: '2',
    startTime: 15,
    endTime: 32,
    text: "First, let's examine the shift from server-side rendering to client-side applications. This transformation has fundamentally changed how we build web experiences.",
  },
  {
    id: '3',
    startTime: 32,
    endTime: 48,
    text: "The key principles we'll cover include component-based architecture, state management, and reactive programming patterns.",
  },
  {
    id: '4',
    startTime: 48,
    endTime: 65,
    text: "These principles have been refined over years of practice and real-world application in production environments.",
  },
  {
    id: '5',
    startTime: 65,
    endTime: 80,
    text: "Moving forward, we'll explore specific examples from popular frameworks like React, Vue, and Angular.",
  },
  {
    id: '6',
    startTime: 80,
    endTime: 98,
    text: "Each framework brings its own philosophy and approach to solving common problems in web development.",
  },
  {
    id: '7',
    startTime: 98,
    endTime: 115,
    text: "Understanding these differences helps you choose the right tool for your specific use case and project requirements.",
  },
  {
    id: '8',
    startTime: 115,
    endTime: 132,
    text: "Now let's dive into component composition and how to build reusable, maintainable UI elements.",
  },
  {
    id: '9',
    startTime: 132,
    endTime: 150,
    text: "Component composition allows us to break down complex interfaces into smaller, more manageable pieces.",
  },
  {
    id: '10',
    startTime: 150,
    endTime: 168,
    text: "This modular approach not only improves code organization but also enhances testability and reusability.",
  },
];

export const Default: Story = {
  args: {
    blocks: sampleBlocks,
    currentTime: 0,
    autoScroll: true,
  },
  render: (args) => (
    <div className="h-screen bg-background">
      <TranscriptionBlockViewer {...args} />
    </div>
  ),
};

export const WithActiveBlock: Story = {
  args: {
    blocks: sampleBlocks,
    currentTime: 50,
    autoScroll: true,
  },
  render: (args) => (
    <div className="h-screen bg-background">
      <TranscriptionBlockViewer {...args} />
    </div>
  ),
};

export const AutoScrollDisabled: Story = {
  args: {
    blocks: sampleBlocks,
    currentTime: 100,
    autoScroll: false,
  },
  render: (args) => (
    <div className="h-screen bg-background">
      <TranscriptionBlockViewer {...args} />
    </div>
  ),
};

export const SimulatedPlayback: Story = {
  render: () => {
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [autoScroll, setAutoScroll] = useState(true);

    useEffect(() => {
      if (!isPlaying) return;

      const interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.5;
          return next >= 180 ? 0 : next; // Loop back to start
        });
      }, 500);

      return () => clearInterval(interval);
    }, [isPlaying]);

    const handleSeek = (time: number) => {
      setCurrentTime(time);
    };

    return (
      <div className="h-screen bg-background">
        <div className="absolute top-4 left-4 z-30 bg-card border border-border rounded-lg p-4 space-y-2">
          <div className="text-sm font-mono">
            Time: {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}
          </div>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        </div>
        <TranscriptionBlockViewer
          blocks={sampleBlocks}
          currentTime={currentTime}
          autoScroll={autoScroll}
          onAutoScrollChange={setAutoScroll}
          onSeek={handleSeek}
        />
      </div>
    );
  },
};

export const FewBlocks: Story = {
  args: {
    blocks: sampleBlocks.slice(0, 3),
    currentTime: 20,
    autoScroll: true,
  },
  render: (args) => (
    <div className="h-screen bg-background">
      <TranscriptionBlockViewer {...args} />
    </div>
  ),
};

export const ManyBlocks: Story = {
  render: () => {
    const manyBlocks: TranscriptionBlockData[] = Array.from({ length: 50 }, (_, i) => ({
      id: `${i + 1}`,
      startTime: i * 10,
      endTime: (i + 1) * 10,
      text: `This is transcription block number ${i + 1}. It contains sample text to demonstrate how the viewer handles a large number of blocks.`,
    }));

    return (
      <div className="h-screen bg-background">
        <TranscriptionBlockViewer
          blocks={manyBlocks}
          currentTime={250}
          autoScroll={true}
        />
      </div>
    );
  },
};
