import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './card';

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card>
      <p>This is a simple card with default styling.</p>
    </Card>
  ),
};

export const WithContent: Story = {
  render: () => (
    <Card>
      <h3 className="text-lg font-semibold mb-2">Card Title</h3>
      <p className="text-muted-foreground">
        This card contains a title and some descriptive text. Cards are useful
        for grouping related content together.
      </p>
    </Card>
  ),
};

export const NoPadding: Story = {
  render: () => (
    <Card className="p-0">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold">Header Section</h3>
      </div>
      <div className="p-6">
        <p className="text-muted-foreground">
          This card has no default padding and uses custom padding for each section.
        </p>
      </div>
    </Card>
  ),
};

export const MultipleCards: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <h4 className="font-semibold mb-2">Card 1</h4>
        <p className="text-sm text-muted-foreground">First card content</p>
      </Card>
      <Card>
        <h4 className="font-semibold mb-2">Card 2</h4>
        <p className="text-sm text-muted-foreground">Second card content</p>
      </Card>
      <Card>
        <h4 className="font-semibold mb-2">Card 3</h4>
        <p className="text-sm text-muted-foreground">Third card content</p>
      </Card>
    </div>
  ),
};

export const Interactive: Story = {
  render: () => (
    <Card className="cursor-pointer transition-colors hover:bg-accent">
      <h3 className="text-lg font-semibold mb-2">Clickable Card</h3>
      <p className="text-muted-foreground">
        This card changes background on hover, making it feel interactive.
      </p>
    </Card>
  ),
};

export const CustomStyling: Story = {
  render: () => (
    <div className="space-y-4">
      <Card className="border-primary">
        <p>Card with primary border color</p>
      </Card>
      <Card className="border-destructive">
        <p>Card with destructive border color</p>
      </Card>
      <Card className="p-3">
        <p className="text-sm">Card with smaller padding</p>
      </Card>
    </div>
  ),
};
