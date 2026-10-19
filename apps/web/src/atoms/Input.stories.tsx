import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';

const meta = { component: Input, args: { 'aria-label': 'Node' } } satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { placeholder: 'frontend' } };
export const Filled: Story = { args: { defaultValue: 'auth-service' } };
export const NumberInput: Story = { args: { type: 'number', defaultValue: 3 } };
export const Focused: Story = { args: { autoFocus: true } };
export const Disabled: Story = { args: { disabled: true, defaultValue: 'auth-service' } };
