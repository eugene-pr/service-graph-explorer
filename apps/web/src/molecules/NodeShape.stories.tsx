import type { Meta, StoryObj } from '@storybook/react-vite';
import { NodeShape } from './NodeShape';
import { PublicBadge } from './PublicBadge';
import { SeverityBadge } from './SeverityBadge';

const meta = {
  component: NodeShape,
  args: { sink: false, inferred: false, className: 'w-48 px-3 py-2 text-sm' },
} satisfies Meta<typeof NodeShape>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Service: Story = { args: { children: 'auth-service' } };
export const PublicService: Story = {
  args: {
    children: (
      <div className="flex items-center justify-between gap-2">
        frontend <PublicBadge />
      </div>
    ),
  },
};
export const VulnerableService: Story = {
  args: {
    children: (
      <div className="flex items-center justify-between gap-2">
        auth-service <SeverityBadge severity="high" />
      </div>
    ),
  },
};
export const Entry: Story = { args: { entry: true, children: 'frontend' } };
export const Sink: Story = { args: { sink: true, children: 'prod-postgresdb' } };
export const InferredService: Story = { args: { inferred: true, children: 'assurance-service' } };
export const InferredSink: Story = { args: { sink: true, inferred: true, children: 'orders-db' } };
