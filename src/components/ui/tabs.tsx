import * as React from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (next: string) => void;
  baseId: string;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error("Tabs components must be used inside <Tabs>");
  }
  return ctx;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      className,
      defaultValue,
      value: controlled,
      onValueChange,
      children,
      ...props
    },
    ref,
  ) => {
    const [internal, setInternal] = React.useState<string>(defaultValue ?? "");
    const baseId = React.useId();
    const value = controlled ?? internal;
    const setValue = React.useCallback(
      (next: string) => {
        if (controlled === undefined) setInternal(next);
        onValueChange?.(next);
      },
      [controlled, onValueChange],
    );

    const ctxValue = React.useMemo<TabsContextValue>(
      () => ({ value, setValue, baseId }),
      [value, setValue, baseId],
    );

    return (
      <TabsContext.Provider value={ctxValue}>
        <div ref={ref} className={cn(className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      "bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-lg p-1",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const { value: active, setValue, baseId } = useTabsContext();
    const isActive = value === active;
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${baseId}-trigger-${value}`}
        aria-selected={isActive}
        aria-controls={`${baseId}-panel-${value}`}
        tabIndex={isActive ? 0 : -1}
        data-state={isActive ? "active" : "inactive"}
        onClick={(event) => {
          setValue(value);
          onClick?.(event);
        }}
        className={cn(
          "ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          isActive
            ? "bg-background text-foreground shadow"
            : "hover:text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, hidden, ...props }, ref) => {
    const { value: active, baseId } = useTabsContext();
    const isActive = value === active;
    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${baseId}-panel-${value}`}
        aria-labelledby={`${baseId}-trigger-${value}`}
        hidden={hidden ?? !isActive}
        data-state={isActive ? "active" : "inactive"}
        className={cn(
          "ring-offset-background focus-visible:ring-ring mt-3 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
