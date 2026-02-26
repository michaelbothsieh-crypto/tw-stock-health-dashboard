import { Tile } from "@/components/bento/Tile";

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-neutral-800/50 ${className}`} />;
}

export function DesktopStockSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.618fr_1fr] gap-6 items-start">
      {/* Primary Column */}
      <div className="flex flex-col gap-6">
        {/* Hero Skeleton */}
        <Tile className="min-h-[240px] p-8 rounded-2xl border border-neutral-800/60 bg-neutral-900/40">
          <div className="space-y-6">
            <SkeletonPulse className="h-11 w-48 rounded-full" />
            <div className="flex items-center gap-4">
              <SkeletonPulse className="h-12 w-64" />
              <SkeletonPulse className="h-10 w-24" />
            </div>
            <div className="space-y-2">
              <SkeletonPulse className="h-8 w-1/2" />
              <SkeletonPulse className="h-5 w-2/3" />
            </div>
            <div className="space-y-2 border-l-2 border-neutral-800 pl-4">
              <SkeletonPulse className="h-4 w-32" />
              <SkeletonPulse className="h-4 w-40" />
              <SkeletonPulse className="h-4 w-36" />
            </div>
          </div>
        </Tile>

        {/* Chart Skeleton */}
        <Tile className="min-h-[320px] p-6 rounded-2xl border border-neutral-800/60 bg-neutral-900/40">
          <SkeletonPulse className="h-6 w-32 mb-6" />
          <SkeletonPulse className="h-[220px] w-full" />
        </Tile>
      </div>

      {/* Secondary Column */}
      <div className="flex flex-col gap-6">
        {/* Crash Warning Skeleton */}
        <Tile className="min-h-[180px] p-6 rounded-2xl border border-neutral-800/60 bg-neutral-900/40">
          <div className="flex justify-between mb-4">
            <SkeletonPulse className="h-5 w-32" />
            <SkeletonPulse className="h-6 w-16" />
          </div>
          <SkeletonPulse className="h-12 w-24 mb-4" />
          <div className="space-y-2">
            <SkeletonPulse className="h-4 w-full" />
            <SkeletonPulse className="h-4 w-5/6" />
          </div>
        </Tile>

        {/* Evidence Skeleton */}
        <Tile className="p-6 rounded-2xl border border-neutral-800/60 bg-neutral-900/40">
          <SkeletonPulse className="h-5 w-24 mb-4" />
          <div className="space-y-3">
            <SkeletonPulse className="h-14 w-full" />
            <SkeletonPulse className="h-14 w-full" />
            <SkeletonPulse className="h-14 w-full" />
          </div>
        </Tile>

        {/* Linkage Skeleton */}
        <Tile className="p-6 rounded-2xl border border-neutral-800/60 bg-neutral-900/40">
          <SkeletonPulse className="h-5 w-36 mb-4" />
          <div className="space-y-4">
            <SkeletonPulse className="h-20 w-full" />
            <SkeletonPulse className="h-32 w-full" />
          </div>
        </Tile>
      </div>
    </div>
  );
}

export function MobileStockSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Hero Skeleton */}
      <Tile className="min-h-[200px] p-5 rounded-2xl border border-neutral-800/60 bg-neutral-900/40">
        <SkeletonPulse className="h-11 w-full mb-6" />
        <div className="flex justify-between items-center mb-6">
          <SkeletonPulse className="h-10 w-24" />
          <div className="flex flex-col items-end gap-2">
            <SkeletonPulse className="h-10 w-20" />
            <SkeletonPulse className="h-5 w-12" />
          </div>
        </div>
        <SkeletonPulse className="h-16 w-full" />
      </Tile>

      {/* Chart Skeleton */}
      <Tile className="min-h-[240px] p-4 rounded-2xl border border-neutral-800/60 bg-neutral-900/40">
        <SkeletonPulse className="h-[200px] w-full" />
      </Tile>

      {/* Warning Skeleton */}
      <Tile className="min-h-[140px] p-5 rounded-2xl border border-neutral-800/60 bg-neutral-900/40">
        <SkeletonPulse className="h-5 w-32 mb-4" />
        <div className="flex gap-4 mb-4">
          <SkeletonPulse className="h-10 w-20" />
          <SkeletonPulse className="h-6 w-16" />
        </div>
        <SkeletonPulse className="h-4 w-full" />
      </Tile>

      {/* Evidence Skeleton */}
      <Tile className="p-5 rounded-2xl border border-neutral-800/60 bg-neutral-900/40">
        <SkeletonPulse className="h-14 w-full mb-3" />
        <SkeletonPulse className="h-14 w-full mb-3" />
        <SkeletonPulse className="h-14 w-full" />
      </Tile>
    </div>
  );
}
