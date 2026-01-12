import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TranscriptionBlock } from './transcription-block';

const meta = {
  title: 'UI/TranscriptionBlock',
  component: TranscriptionBlock,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TranscriptionBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: '1',
    startTime: 0,
    endTime: 15,
    text: "Welcome to this presentation. Today we'll be discussing the fundamentals of modern web development and how it has evolved over the past decade.",
    isActive: false,
    onSeek: (time: number) => console.log('Seeking to:', time),
  },
};

export const Active: Story = {
  args: {
    id: '2',
    startTime: 45,
    endTime: 62,
    text: "The key principles we'll cover include component-based architecture, state management, and reactive programming patterns.",
    isActive: true,
    onSeek: (time: number) => console.log('Seeking to:', time),
  },
};

export const ShortTranscription: Story = {
  args: {
    id: '3',
    startTime: 120,
    endTime: 125,
    text: "Let's begin.",
    isActive: false,
  },
};

export const LongTranscription: Story = {
  args: {
    id: '4',
    startTime: 180,
    endTime: 210,
    text: "In modern web development, we've seen a significant shift towards declarative programming paradigms. This approach allows developers to describe what they want to achieve rather than explicitly coding how to achieve it. Frameworks like React, Vue, and Svelte have embraced this philosophy, making it easier to build complex user interfaces while maintaining code clarity and reusability.",
    isActive: false,
  },
};

export const LongTimestamp: Story = {
  args: {
    id: '5',
    startTime: 3725,
    endTime: 3758,
    text: "As we approach the end of this section, remember that the patterns we've discussed are foundational to understanding modern application architecture.",
    isActive: false,
  },
};

export const Interactive: Story = {
  render: () => {
    const [text, setText] = useState(
      "This is an editable transcription block. Try clicking and typing to edit the content."
    );
    const [isActive, setIsActive] = useState(false);

    return (
      <div className="space-y-4">
        <TranscriptionBlock
          id="interactive-1"
          startTime={30}
          endTime={42}
          text={text}
          isActive={isActive}
          onTextChange={(_id, newText) => setText(newText)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setIsActive(!isActive)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
          >
            Toggle Active State
          </button>
        </div>
      </div>
    );
  },
};

export const MultipleBlocks: Story = {
  render: () => {
    const blocks = [
      {
        id: 'multi-1',
        startTime: 0,
        endTime: 12,
        text: "Introduction to the topic and overview of what we'll be covering today.",
        isActive: false,
      },
      {
        id: 'multi-2',
        startTime: 12,
        endTime: 28,
        text: "First, let's discuss the fundamental concepts that form the foundation of our approach.",
        isActive: true,
      },
      {
        id: 'multi-3',
        startTime: 28,
        endTime: 45,
        text: "These principles have been refined over years of practice and real-world application.",
        isActive: false,
      },
      {
        id: 'multi-4',
        startTime: 45,
        endTime: 58,
        text: "Moving forward, we'll explore specific examples.",
        isActive: false,
      },
    ];

    const handleSeek = (time: number) => {
      console.log('Seeking to:', time);
    };

    return (
      <div className="space-y-3 max-w-2xl">
        {blocks.map((block) => (
          <TranscriptionBlock key={block.id} {...block} onSeek={handleSeek} />
        ))}
      </div>
    );
  },
};

export const EmptyBlock: Story = {
  args: {
    id: 'empty-1',
    startTime: 0,
    endTime: 0,
    text: "",
    isActive: false,
  },
};
