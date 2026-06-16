import { Card, CardContent } from "@/components/ui/card";

export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded bg-bg-hover" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-bg-hover" />
      </div>

      <div className="h-28 animate-pulse rounded-lg border border-border-subtle bg-bg-hover/60" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border border-border-subtle bg-bg-hover/60"
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-4 h-5 w-40 animate-pulse rounded bg-bg-hover" />
            <div className="h-44 animate-pulse rounded bg-bg-hover/80" />
          </CardContent>
        </Card>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-lg border border-border-subtle bg-bg-hover/60"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
