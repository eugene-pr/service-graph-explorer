import type { Meta, StoryObj } from '@storybook/react-vite';
import { PublicBadge } from './PublicBadge';

const meta = { component: PublicBadge } satisfies Meta<typeof PublicBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
