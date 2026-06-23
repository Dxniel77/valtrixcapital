import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function CompanyToolsPanelSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border border-border-subtle bg-bg-hover/60"
          />
        ))}
      </div>
      <Card>
        <CardHeader>
          <div className="h-5 w-48 animate-pulse rounded bg-bg-hover" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-bg-hover/80" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function CompanyToolsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading company tools">
      <div className="space-y-2">
        <div className="h-8 w-72 animate-pulse rounded bg-bg-hover" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-bg-hover" />
      </div>
      <div className="h-36 animate-pulse rounded-lg border border-border-subtle bg-bg-hover/60" />
      <div className="h-11 w-80 animate-pulse rounded-lg bg-bg-hover/60" />
      <CompanyToolsPanelSkeleton />
    </div>
  );
}
