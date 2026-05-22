import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const clamped = Math.max(0, Math.min(value, max));
    const percent = max === 0 ? 0 : (clamped / max) * 100;
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        className={cn(
          "bg-secondary relative h-2 w-full overflow-hidden rounded-full",
          className,
        )}
        {...props}
      >
        <div
          className="bg-primary h-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
