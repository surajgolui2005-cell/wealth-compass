import { QueryClient } from '@tanstack/react-query';

let _queryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (!_queryClient) {
    _queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30 * 1000,
          retry: 1,
          refetchOnWindowFocus: false, // no window in React Native
        },
        mutations: { retry: 0 },
      },
    });
  }
  return _queryClient;
}
