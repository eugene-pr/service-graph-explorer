import type { Meta, StoryObj } from '@storybook/react-vite';
import { RouteChip } from './RouteChip';

const meta = { component: RouteChip } satisfies Meta<typeof RouteChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleNode: Story = { args: { route: ['frontend'] } };
export const ThreeNodes: Story = { args: { route: ['frontend', 'auth-service', 'prod-postgresdb'] } };
export const Long: Story = {
  args: { route: ['frontend', 'gateway', 'orders-service', 'payments-service', 'ledger-service', 'auth-service', 'prod-postgresdb'] },
  decorators: [(Story) => <div className="w-72">{Story()}</div>],
};
