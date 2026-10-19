import type { FlatQuery } from '@sge/domain';
import { useMemo, useSyncExternalStore, type SetStateAction } from 'react';
import { DEFAULT_QUERY, readQueryUrl } from '../lib/queryUrl';
import { toSearchParams } from '../lib/queryString';

export { DEFAULT_QUERY } from '../lib/queryUrl';

const QUERY_CHANGE = 'querychange';
const getSearch = () => window.location.search;
const subscribe = (onChange: () => void) => {
  window.addEventListener('popstate', onChange);
  window.addEventListener(QUERY_CHANGE, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(QUERY_CHANGE, onChange);
  };
};

function updateUrl(update: (current: ReturnType<typeof readQueryUrl>) => { query: FlatQuery; matchedOnly: boolean }) {
  const next = update(readQueryUrl(getSearch()));
  const search = toSearchParams(next.query);
  if (next.matchedOnly) search.set('view', 'matched');
  const url = new URL(window.location.href);
  url.search = search.toString();
  if (url.href === window.location.href) return;
  window.history.pushState(null, '', url);
  window.dispatchEvent(new Event(QUERY_CHANGE));
}

/** The URL is the one home for the current Query, including browser history. */
export function useQueryState() {
  const search = useSyncExternalStore(subscribe, getSearch);
  const state = useMemo(() => readQueryUrl(search), [search]);
  // Keep the Query identity stable during view changes so the panel keeps its unsubmitted edits.
  const querySearch = toSearchParams(state.query).toString();
  const query = useMemo(() => readQueryUrl(querySearch).query, [querySearch]);
  const { matchedOnly } = state;
  return useMemo(() => {
    return {
      query,
      matchedOnly,
      setQuery: (next: SetStateAction<FlatQuery>) => updateUrl((current) => ({
        ...current,
        query: typeof next === 'function' ? next(current.query) : next,
      })),
      setMatchedOnly: (next: SetStateAction<boolean>) => updateUrl((current) => ({
        ...current,
        matchedOnly: typeof next === 'function' ? next(current.matchedOnly) : next,
      })),
      reset: () => updateUrl(() => ({ query: DEFAULT_QUERY, matchedOnly: false })),
    };
  }, [query, matchedOnly]);
}

/** The notice uses the same URL snapshot without adding notice state to the Query hook's interface. */
export function useQueryUrlNotice() {
  const search = useSyncExternalStore(subscribe, getSearch);
  return useMemo(() => readQueryUrl(search).invalid, [search]);
}
