import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from './slider';
import { useState } from 'react';

const meta = {
  title: 'UI/Slider',
  component: Slider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    min: {
      control: 'number',
      description: 'Minimum value',
    },
    max: {
      control: 'number',
      description: 'Maximum value',
    },
    step: {
      control: 'number',
      description: 'Step increment',
    },
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState([50]);
    return (
      <div className="w-80">
        <div className="mb-4 text-sm">
          Value: <span className="font-medium">{value[0]}</span>
        </div>
        <Slider value={value} onValueChange={setValue} max={100} step={1} />
      </div>
    );
  },
};

export const Range: Story = {
  render: () => {
    const [value, setValue] = useState([25, 75]);
    return (
      <div className="w-80">
        <div className="mb-4 text-sm">
          Range: <span className="font-medium">{value[0]} - {value[1]}</span>
        </div>
        <Slider value={value} onValueChange={setValue} max={100} step={1} />
      </div>
    );
  },
};

export const PlaybackSpeed: Story = {
  render: () => {
    const [speed, setSpeed] = useState([1]);
    return (
      <div className="w-80">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Speed</span>
          <span className="font-medium">{speed[0].toFixed(2)}x</span>
        </div>
        <Slider
          value={speed}
          onValueChange={setSpeed}
          min={0.25}
          max={2}
          step={0.25}
          showSteps
        />
      </div>
    );
  },
};

export const Volume: Story = {
  render: () => {
    const [volume, setVolume] = useState([70]);
    return (
      <div className="w-80">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Volume</span>
          <span className="font-medium">{volume[0]}%</span>
        </div>
        <Slider value={volume} onValueChange={setVolume} max={100} step={1} />
      </div>
    );
  },
};

export const SmallSteps: Story = {
  render: () => {
    const [value, setValue] = useState([5]);
    return (
      <div className="w-80">
        <div className="mb-4 text-sm">
          Value: <span className="font-medium">{value[0].toFixed(1)}</span>
        </div>
        <Slider
          value={value}
          onValueChange={setValue}
          min={0}
          max={10}
          step={0.1}
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => {
    return (
      <div className="w-80">
        <div className="mb-4 text-sm text-muted-foreground">
          Disabled slider
        </div>
        <Slider value={[50]} max={100} disabled />
      </div>
    );
  },
};

export const WithSteps: Story = {
  render: () => {
    const [value, setValue] = useState([5]);
    return (
      <div className="w-80">
        <div className="mb-4 text-sm">
          Value: <span className="font-medium">{value[0]}</span>
        </div>
        <Slider
          value={value}
          onValueChange={setValue}
          min={0}
          max={10}
          step={1}
          showSteps
        />
      </div>
    );
  },
};

export const AllVariants: Story = {
  render: () => {
    const [value1, setValue1] = useState([30]);
    const [value2, setValue2] = useState([20, 80]);
    const [value3, setValue3] = useState([1.5]);

    return (
      <div className="w-80 space-y-8">
        <div>
          <div className="mb-2 text-sm font-medium">Single Value</div>
          <Slider value={value1} onValueChange={setValue1} max={100} />
          <div className="mt-1 text-xs text-muted-foreground">Value: {value1[0]}</div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Range</div>
          <Slider value={value2} onValueChange={setValue2} max={100} />
          <div className="mt-1 text-xs text-muted-foreground">
            Range: {value2[0]} - {value2[1]}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Custom Step (0.25)</div>
          <Slider
            value={value3}
            onValueChange={setValue3}
            min={0.5}
            max={2}
            step={0.25}
            showSteps
          />
          <div className="mt-1 text-xs text-muted-foreground">
            Value: {value3[0].toFixed(2)}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Disabled</div>
          <Slider value={[50]} max={100} disabled />
        </div>
      </div>
    );
  },
};
