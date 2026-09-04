import { QueryClient } from '@tanstack/react-query';

let queryClientSingleton: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create a new instance
    return makeQueryClient();
  }
  // Browser: reuse singleton
  if (!queryClientSingleton) {
    queryClientSingleton = makeQueryClient();
  }
  return queryClientSingleton;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
