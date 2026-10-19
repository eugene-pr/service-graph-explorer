import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { FilterToggle } from './FilterToggle';
import { ParamInput } from './ParamInput';

const meta = {
  component: FilterToggle,
  args: { name: 'startsAtPublic', description: 'Starts at a publicly exposed service.', checked: false, onChange: fn() },
} satisfies Meta<typeof FilterToggle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const On: Story = { args: { checked: true } };

const hopsParam = (
  <div className="pl-6">
    <ParamInput id="filter-maxLength-hops" name="hops" schema={{ type: 'integer' }} required value="3" onChange={fn()} />
  </div>
);

/** Param inputs stay hidden while the Filter is off. */
export const OffWithParams: Story = {
  args: { name: 'maxLength', description: 'Has at most this many hops (edges).', children: hopsParam },
};
export const OnWithParams: Story = {
  args: { name: 'maxLength', description: 'Has at most this many hops (edges).', checked: true, children: hopsParam },
};
