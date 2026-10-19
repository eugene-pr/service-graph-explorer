import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = { component: Badge, args: { children: 'label' } } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Pill: Story = { args: { pill: true } };
export const Colored: Story = { args: { className: 'bg-accent text-white', title: 'Shown on hover' } };
