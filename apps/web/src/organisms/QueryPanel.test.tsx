import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_QUERY } from '../lib/queryUrl';
import { filtersFixture } from '../test/fixtures';
import { QueryPanel } from './QueryPanel';

const renderPanel = (props: Partial<Parameters<typeof QueryPanel>[0]> = {}) => {
  const onRun = vi.fn();
  render(
    <QueryPanel
      filters={filtersFixture.filters}
      query={DEFAULT_QUERY}
      defaultQuery={DEFAULT_QUERY}
      nodeKinds={['service', 'rds']}
      effectiveQuery={undefined}
      onRun={onRun}
      onReset={() => {}}
      {...props}
    />,
  );
  return { onRun };
};

const group = (name: string) => screen.getByRole('group', { name });

describe('QueryPanel advanced mode', () => {
  it('builds a nested and/or/not tree with the keyboard and runs it as the POST body', async () => {
    const user = userEvent.setup();
    const { onRun } = renderPanel();

    screen.getByRole('checkbox', { name: 'Advanced' }).focus();
    await user.keyboard(' ');
    expect(group('AND group')).toBeInTheDocument();

    const addTo = async (groupName: string, option: string) => {
      const adder = group(`Add to ${groupName}`);
      await user.selectOptions(within(adder).getByRole('combobox', { name: 'Member' }), option);
      within(adder).getByRole('button', { name: 'Add' }).focus();
      await user.keyboard('{Enter}');
    };

    await addTo('AND group', 'OR group');
    await addTo('OR group 1', 'passesThrough');
    await addTo('OR group 1', 'passesThrough');
    expect(group('passesThrough 1.2')).toBeInTheDocument();
    within(group('passesThrough 1.2')).getByRole('button', { name: 'Remove passesThrough 1.2' }).focus();
    await user.keyboard('{Enter}');
    expect(within(group('Add to OR group 1')).getByRole('combobox', { name: 'Member' })).toHaveFocus();
    await user.type(within(group('passesThrough 1.1')).getByRole('textbox', { name: 'node' }), 'auth-service');
    await addTo('OR group 1', 'hasVulnerability');
    await user.selectOptions(within(group('hasVulnerability 1.2')).getByRole('combobox', { name: /minSeverity/ }), 'high');
    within(group('hasVulnerability 1.2')).getByRole('button', { name: 'Negate hasVulnerability 1.2' }).focus();
    await user.keyboard('{Enter}');
    expect(group('NOT hasVulnerability 1.2')).toBeInTheDocument();
    expect(within(group('NOT hasVulnerability 1.2')).getByRole('button', { name: 'Negate hasVulnerability 1.2' })).toHaveAttribute('aria-pressed', 'true');

    await addTo('AND group', 'startsAtPublic');
    await addTo('AND group', 'maxLength');
    within(group('maxLength 3')).getByRole('button', { name: 'Remove maxLength 3' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('group', { name: 'maxLength 3' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(onRun).toHaveBeenCalledWith({
      query: {
        and: [
          {
            or: [
              { filter: 'passesThrough', params: { node: 'auth-service' } },
              { not: { filter: 'hasVulnerability', params: { minSeverity: 'high' } } },
            ],
          },
          { filter: 'startsAtPublic' },
        ],
      },
      limit: 100,
    });
  });

  it('turns the flat Query into an AND tree when switching to advanced', async () => {
    const user = userEvent.setup();
    const { onRun } = renderPanel({
      query: { filters: ['endsAtSink', 'maxLength'], params: { endsAtSink: { kinds: 'rds' }, maxLength: { hops: '3' } }, limit: 7 },
    });

    await user.click(screen.getByRole('checkbox', { name: 'Advanced' }));
    const root = group('AND group');
    expect(within(root).getByRole('group', { name: 'endsAtSink 1' })).toBeInTheDocument();
    expect(within(group('maxLength 2')).getByRole('spinbutton', { name: 'hops' })).toHaveValue(3);
    await user.click(screen.getByRole('button', { name: 'Run' }));

    expect(onRun).toHaveBeenCalledWith({
      query: { and: [{ filter: 'endsAtSink', params: { kinds: ['rds'] } }, { filter: 'maxLength', params: { hops: 3 } }] },
      limit: 7,
    });
  });

  it('keeps tree edits when toggled off and on without flat edits, and rebuilds the tree after flat edits', async () => {
    const user = userEvent.setup();
    renderPanel();
    const advanced = () => screen.getByRole('checkbox', { name: 'Advanced' });
    await user.click(advanced());
    await user.selectOptions(within(group('Add to AND group')).getByRole('combobox', { name: 'Member' }), 'OR group');
    await user.click(within(group('Add to AND group')).getByRole('button', { name: 'Add' }));
    await user.click(advanced());
    await user.click(advanced());
    expect(group('OR group 1')).toBeInTheDocument();

    await user.click(advanced());
    await user.click(screen.getByRole('checkbox', { name: 'startsAtPublic' }));
    await user.click(advanced());
    expect(screen.queryByRole('group', { name: 'OR group 1' })).not.toBeInTheDocument();
    expect(group('startsAtPublic 1')).toBeInTheDocument();
  });

  it('switches back to the flat Filter list with its draft intact', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('checkbox', { name: 'startsAtPublic' }));
    await user.click(screen.getByRole('checkbox', { name: 'Advanced' }));
    expect(screen.queryByRole('checkbox', { name: 'startsAtPublic' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Advanced' }));
    expect(screen.getByRole('checkbox', { name: 'startsAtPublic' })).toBeChecked();
  });

  it('shows tree param errors with the leaf position and does not run', async () => {
    const user = userEvent.setup();
    const { onRun } = renderPanel({ query: { query: { or: [{ filter: 'maxLength', params: { hops: 0 } }] }, limit: 100 } });

    expect(screen.getByRole('checkbox', { name: 'Advanced' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/query\.or\.0.*maxLength\.hops/);
  });

  it('shows the effective Query read-only', () => {
    renderPanel({
      query: { query: { or: [{ filter: 'startsAtPublic' }] }, limit: 100 },
      effectiveQuery: { and: [{ filter: 'startsAtEntry' }, { or: [{ filter: 'startsAtPublic' }] }] },
    });
    const effective = screen.getByRole('region', { name: 'Effective Query' });
    expect(effective).toHaveTextContent('startsAtEntry');
    expect(within(effective).queryByRole('textbox')).not.toBeInTheDocument();
  });
});
