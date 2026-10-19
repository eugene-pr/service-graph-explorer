import type { Meta, StoryObj } from '@storybook/react-vite';
import { WarningsBanner } from './WarningsBanner';

const meta = { component: WarningsBanner } satisfies Meta<typeof WarningsBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Renders nothing. */
export const None: Story = { args: { warnings: [] } };
export const One: Story = {
  args: { warnings: ['Node "assurance-service" is referenced by an edge but not defined; added as an Inferred Node of kind "service".'] },
};
/** The list scrolls once it outgrows its bounded height. */
export const Many: Story = {
  args: { warnings: Array.from({ length: 12 }, (_, i) => `Node "service-${i}" is referenced by an edge but not defined.`) },
};
