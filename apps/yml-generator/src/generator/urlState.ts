const txidSearchParam = 'txid';

export function readTransactionInputFromSearch(search: string): string {
  return new URLSearchParams(search).get(txidSearchParam)?.trim() ?? '';
}

export function buildTransactionSearchHref(options: {
  currentUrl: string;
  txId?: string;
}): string {
  const nextUrl = new URL(options.currentUrl);

  if (options.txId?.trim()) {
    nextUrl.searchParams.set(txidSearchParam, options.txId.trim());
  } else {
    nextUrl.searchParams.delete(txidSearchParam);
  }

  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
}
