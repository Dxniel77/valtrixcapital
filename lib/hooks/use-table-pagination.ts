"use client";

import * as React from "react";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type TablePageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function useTablePagination<T>(
  items: T[],
  options?: {
    pageSize?: number;
    /** When this value changes, pagination resets to page 1 (e.g. filter query). */
    resetKey?: string | number;
  },
) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(
    options?.pageSize ?? DEFAULT_PAGE_SIZE,
  );

  React.useEffect(() => {
    setPage(1);
  }, [options?.resetKey, pageSize]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedItems = React.useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalItems);

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    paginatedItems,
    rangeStart,
    rangeEnd,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  };
}
