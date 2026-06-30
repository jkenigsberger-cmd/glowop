import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// Cache for 1 min so the many cards/banners/tabs on a page don't
			// re-fire identical requests on every mount (avoids API rate limits).
			staleTime: 60 * 1000,
		},
	},
});