import * as React from "react";

/**
 * Test mock for `@/components/ui/select` (the Radix-based shadcn Select).
 *
 * Radix Select relies on pointer-capture / portal APIs that don't work in
 * jsdom. For tests we render a real native `<select>` populated from the
 * declarative `SelectTrigger` / `SelectContent` / `SelectItem` children so
 * tests can keep using `getByLabelText`, `select.options`, and
 * `fireEvent.change(select, { target: { value } })`.
 *
 * Usage:
 *
 * ```ts
 * vi.mock("@/components/ui/select", async () => {
 *   const mod = await import("@/tests/select-mock");
 *   return mod.selectMock;
 * });
 * ```
 */

type Items = Array<{ value: string; node: React.ReactNode; disabled?: boolean }>;

function getDisplayName(node: React.ReactElement): string | undefined {
  const t = node.type as { displayName?: string; name?: string };
  return t.displayName ?? t.name;
}

function collectChildren(
  children: React.ReactNode,
  onTrigger: (props: Record<string, unknown>) => void,
  onItem: (item: Items[number]) => void,
): void {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const name = getDisplayName(child);
    const childProps = child.props as { children?: React.ReactNode } & Record<
      string,
      unknown
    >;
    if (name === "SelectTrigger") {
      const rest: Record<string, unknown> = { ...childProps };
      delete rest.children;
      onTrigger(rest);
      return;
    }
    if (name === "SelectContent") {
      collectChildren(childProps.children, onTrigger, onItem);
      return;
    }
    if (name === "SelectItem") {
      onItem({
        value: String(childProps.value),
        node: childProps.children,
        disabled: Boolean(childProps.disabled),
      });
      return;
    }
    if (childProps.children !== undefined) {
      collectChildren(childProps.children, onTrigger, onItem);
    }
  });
}

interface SelectProps {
  children?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
}

function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
}: SelectProps) {
  let triggerProps: Record<string, unknown> = {};
  const items: Items = [];
  collectChildren(
    children,
    (props) => {
      triggerProps = props;
    },
    (item) => items.push(item),
  );

  const triggerDisabled =
    typeof triggerProps.disabled === "boolean"
      ? (triggerProps.disabled as boolean)
      : false;

  const resolved = value ?? defaultValue ?? "";
  return (
    <select
      {...(triggerProps as React.SelectHTMLAttributes<HTMLSelectElement>)}
      name={(triggerProps.name as string | undefined) ?? name}
      value={resolved}
      disabled={disabled || triggerDisabled}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {items.map((item) => (
        <option key={item.value} value={item.value} disabled={item.disabled}>
          {item.node}
        </option>
      ))}
    </select>
  );
}

const SelectTrigger: React.FC<{ children?: React.ReactNode }> = () => null;
SelectTrigger.displayName = "SelectTrigger";

const SelectContent: React.FC<{ children?: React.ReactNode }> = () => null;
SelectContent.displayName = "SelectContent";

const SelectItem: React.FC<{
  value: string;
  children?: React.ReactNode;
  disabled?: boolean;
}> = () => null;
SelectItem.displayName = "SelectItem";

const SelectValue: React.FC<{ placeholder?: string }> = () => null;
SelectValue.displayName = "SelectValue";

const SelectGroup: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
SelectGroup.displayName = "SelectGroup";

const SelectLabel: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
SelectLabel.displayName = "SelectLabel";

const SelectSeparator: React.FC = () => null;
SelectSeparator.displayName = "SelectSeparator";

const SelectScrollUpButton: React.FC = () => null;
SelectScrollUpButton.displayName = "SelectScrollUpButton";

const SelectScrollDownButton: React.FC = () => null;
SelectScrollDownButton.displayName = "SelectScrollDownButton";

export const selectMock = {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
