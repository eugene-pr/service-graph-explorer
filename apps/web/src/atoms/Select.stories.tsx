import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';

const options = ['low', 'medium', 'high', 'critical'].map((severity) => <option key={severity}>{severity}</option>);

const meta = { component: Select, args: { 'aria-label': 'Severity', children: options } } satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Focused: Story = { args: { autoFocus: true } };
export const Disabled: Story = { args: { disabled: true } };
