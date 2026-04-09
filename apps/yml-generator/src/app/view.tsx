import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type JSX } from 'react';

import { GeneratorView } from '@app/generator/view';

export function App(): JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <GeneratorView />
    </QueryClientProvider>
  );
}
