import { useMemo, useSyncExternalStore, type SetStateAction } from 'react';
import { DEFAULT_QUERY, queryIdentity, readQueryUrl, writeQueryUrl } from '../lib/queryUrl';
import type { ExplorerQuery } from '../lib/queryTree';

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

function updateUrl(update: (current: ReturnType<typeof readQueryUrl>) => { query: ExplorerQuery; matchedOnly: boolean }) {
  const next = update(readQueryUrl(getSearch()));
  const search = writeQueryUrl(next.query);
  if (next.matchedOnly) search.set('view', 'matched');
  // Invalid incoming URLs recover to defaults; invalid edits must leave the current Query intact.
  if (readQueryUrl(search.toString()).invalid) return;
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
  const querySearch = queryIdentity(state.query);
  const query = useMemo(() => readQueryUrl(querySearch).query, [querySearch]);
  const { matchedOnly } = state;
  return useMemo(() => {
    return {
      query,
      matchedOnly,
      setQuery: (next: SetStateAction<ExplorerQuery>) => updateUrl((current) => ({
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
