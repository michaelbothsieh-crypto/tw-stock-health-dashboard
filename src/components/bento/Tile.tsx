import { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TileProps {
  className?: string;
  children: ReactNode;
}

interface TileHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  titleClassName?: string;
  descriptionClassName?: string;
}

export const Tile = forwardRef<HTMLElement, TileProps>(function Tile({ className, children }, ref) {
  return (
    <section
      ref={ref}
      className={cn(
        "rounded-3xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-md transition-all hover:scale-[1.02] hover:border-neutral-600",
        className,
      )}
    >
      {children}
    </section>
  );
});

export function TileHeader({
  title,
  description,
  action,
  titleClassName,
  descriptionClassName,
}: TileHeaderProps) {
  return (
    <header className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className={cn("text-lg font-semibold leading-tight text-neutral-100 lg:text-xl", titleClassName)}>{title}</h3>
        {description ? (
          <p className={cn("mt-1 text-base text-neutral-400", descriptionClassName)}>{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex min-h-11 items-center">{action}</div> : null}
    </header>
  );
}

export function TileValue({ value, toneClassName }: { value: string; toneClassName?: string }) {
  return <div className={cn("text-5xl font-semibold tracking-tight lg:text-6xl", toneClassName)}>{value}</div>;
}
