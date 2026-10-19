import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toggle } from './Toggle';

const meta = { component: Toggle, args: { 'aria-label': 'Filter' } } satisfies Meta<typeof Toggle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const On: Story = { args: { defaultChecked: true } };
export const Focused: Story = { args: { autoFocus: true } };
export const Disabled: Story = { args: { disabled: true } };
export const DisabledOn: Story = { args: { disabled: true, defaultChecked: true } };
