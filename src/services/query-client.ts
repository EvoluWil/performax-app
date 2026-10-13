import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export async function clearCompanyQueries() {
  await queryClient.cancelQueries();
  queryClient.removeQueries({ queryKey: ['tasks'] });
  queryClient.removeQueries({ queryKey: ['task'] });
  queryClient.removeQueries({ queryKey: ['notifications'] });
}
