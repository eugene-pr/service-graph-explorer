import type { Meta, StoryObj } from '@storybook/react-vite';
import { SeverityBadge } from './SeverityBadge';

const meta = { component: SeverityBadge } satisfies Meta<typeof SeverityBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Critical: Story = { args: { severity: 'critical' } };
export const High: Story = { args: { severity: 'high' } };
export const Medium: Story = { args: { severity: 'medium' } };
export const Low: Story = { args: { severity: 'low' } };
export const Unknown: Story = { args: { severity: 'unknown', title: 'Severity not reported' } };
