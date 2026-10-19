import { DEFAULT_LIMIT, type FlatQuery } from '@sge/domain';
import { useMemo, useState } from 'react';

/** No Filters: the engine adds `startsAtEntry`, so Routes start at Entries. */
export const DEFAULT_QUERY: FlatQuery = { filters: [], params: {}, limit: DEFAULT_LIMIT };

/**
 * The one place the current Query is read and changed.
 * Backed by local state for now; ticket 09 moves it to the URL behind the same interface.
 */
export function useQueryState() {
  const [query, setQuery] = useState<FlatQuery>(DEFAULT_QUERY);
  const [matchedOnly, setMatchedOnly] = useState(false);
  return useMemo(
    () => ({
      query,
      setQuery,
      matchedOnly,
      setMatchedOnly,
      reset: () => {
        setQuery(DEFAULT_QUERY);
        setMatchedOnly(false);
      },
    }),
    [query, matchedOnly],
  );
}
