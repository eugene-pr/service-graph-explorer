import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = { component: Button, args: { children: 'Run Query' } } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const PrimaryDisabled: Story = { args: { variant: 'primary', disabled: true } };
export const SecondaryDisabled: Story = { args: { variant: 'secondary', disabled: true } };
/** Tab into the canvas to see the focus ring. */
export const Focused: Story = { args: { variant: 'primary', autoFocus: true } };
