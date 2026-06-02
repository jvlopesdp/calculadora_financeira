import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

import { queryClient, SESSION_QUERY_KEY } from "@/lib/query-client";

const STORAGE_KEY = "cf-app-query-v1";

function getStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

let started = false;

export function startQueryPersister(): void {
  if (started) return;
  const storage = getStorage();
  if (!storage) return;

  const persister = createSyncStoragePersister({
    storage,
    key: STORAGE_KEY,
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 24 * 60 * 60 * 1000,
    buster: __COMMIT_SHA__,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        if (
          query.queryKey.length === SESSION_QUERY_KEY.length &&
          query.queryKey.every((part, i) => part === SESSION_QUERY_KEY[i])
        ) {
          return false;
        }
        return query.state.status === "success";
      },
    },
  });

  started = true;
}
