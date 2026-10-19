import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ParamInput, ParamInputs } from './ParamInput';

const meta = {
  component: ParamInput,
  args: { id: 'param', name: 'node', schema: { type: 'string' }, required: true, value: '', onChange: fn() },
} satisfies Meta<typeof ParamInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = { args: { schema: { type: 'string', description: 'Name of a node in the graph.' }, value: 'auth-service' } };
export const NumberParam: Story = {
  args: { name: 'hops', schema: { type: 'integer', description: 'Most edges a Route may have; at least 1.' }, value: '3' },
};
export const EnumOptional: Story = {
  args: {
    name: 'minSeverity',
    required: false,
    schema: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Lowest severity that counts.' },
  },
};
export const EnumRequired: Story = {
  args: { name: 'minSeverity', schema: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }, value: 'high' },
};
/** A list param without known options: a comma-separated text input. */
export const ListAsText: Story = { args: { name: 'kinds', required: false, schema: { type: 'array' }, value: 'rds,s3' } };
/** A list param with options: a checkbox per value. */
export const ListAsCheckboxes: Story = {
  args: {
    name: 'kinds',
    required: false,
    schema: { type: 'array', description: 'Node kinds that count as Sinks.' },
    options: ['service', 'rds', 's3', 'sqs'],
    value: 'rds,s3',
  },
};

export const Inputs: StoryObj<typeof ParamInputs> = {
  render: (args) => <ParamInputs {...args} />,
  args: {
    idPrefix: 'filter-hasVulnerability',
    params: {
      type: 'object',
      properties: {
        minSeverity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        kinds: { type: 'array', 'x-options': 'nodeKinds' },
      },
      required: [],
    },
    values: { minSeverity: 'medium' },
    onChange: fn(),
    nodeKinds: ['service', 'rds'],
  },
};
