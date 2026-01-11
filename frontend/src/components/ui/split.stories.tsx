import type { Meta, StoryObj } from '@storybook/react';
import Split from 'react-split';
import { Card } from './card';
import { GripVertical, GripHorizontal } from 'lucide-preact';
import { render } from 'preact';

const meta = {
  title: 'UI/Split',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ padding: '2rem', height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Split
      sizes={[30, 70]}
      minSize={20}
      gutterSize={16}
      className="h-full w-full rounded-lg flex"
      gutter={(_index, direction) => {
        const gutter = document.createElement('div');
        gutter.className =
          'flex items-center justify-center flex-shrink-0 ' +
          (direction === 'horizontal' ? 'cursor-col-resize' : 'cursor-row-resize');

        const iconContainer = document.createElement('div');
        if (direction === 'horizontal') {
          render(<GripVertical size={16} />, iconContainer);
        } else {
          render(<GripHorizontal size={16} />, iconContainer);
        }
        gutter.appendChild(iconContainer);

        return gutter;
      }}
    >
      <Card className="w-full h-full">
        <h3 className="font-semibold mb-2">Left Panel</h3>
        <p className="text-sm text-muted-foreground">
          This is the left sidebar panel.
        </p>
      </Card>
      <div>
        <Split
          direction="vertical"
          sizes={[50, 50]}
          minSize={20}
          gutterSize={16}
          className="h-full flex flex-col"
          gutter={(_index, direction) => {
            const gutter = document.createElement('div');
            gutter.className =
              'flex items-center justify-center flex-shrink-0 ' +
              (direction === 'horizontal' ? 'cursor-col-resize' : 'cursor-row-resize');

            const iconContainer = document.createElement('div');
            if (direction === 'horizontal') {
              render(<GripVertical size={16} />, iconContainer);
            } else {
              render(<GripHorizontal size={16} />, iconContainer);
            }
            gutter.appendChild(iconContainer);

            return gutter;
          }}
        >
            <Card className="w-full h-full">
              <h3 className="font-semibold mb-2">Top Right Panel</h3>
              <p className="text-sm text-muted-foreground">
                This is the top panel on the right side.
              </p>
            </Card>
            <Card className="w-full h-full">
              <h3 className="font-semibold mb-2">Bottom Right Panel</h3>
              <p className="text-sm text-muted-foreground">
                This is the bottom panel on the right side.
              </p>
            </Card>
        </Split>
      </div>
    </Split>
  ),
};
