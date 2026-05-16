import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

describe("Tabs primitive", () => {
  it("activates the default tab on mount", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );

    const triggerA = screen.getByRole("tab", { name: "A" });
    const triggerB = screen.getByRole("tab", { name: "B" });
    expect(triggerA.getAttribute("aria-selected")).toBe("true");
    expect(triggerB.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByText("Panel A")).toBeVisible();
    // hidden content panels should not render visibly
    const panelB = screen
      .getAllByRole("tabpanel", { hidden: true })
      .find((el) => el.textContent === "Panel B");
    expect(panelB?.hasAttribute("hidden")).toBe(true);
  });

  it("switches the active tab when a trigger is clicked", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "B" }));

    expect(screen.getByRole("tab", { name: "B" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: "A" }).getAttribute("aria-selected")).toBe(
      "false",
    );
    expect(screen.getByText("Panel B")).toBeVisible();
  });

  it("calls onValueChange when controlled and lets the parent drive state", () => {
    const handler = vi.fn();
    const { rerender } = render(
      <Tabs value="a" onValueChange={handler}>
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(handler).toHaveBeenCalledWith("b");
    // controlled value didn't change → A still active
    expect(screen.getByRole("tab", { name: "A" }).getAttribute("aria-selected")).toBe(
      "true",
    );

    rerender(
      <Tabs value="b" onValueChange={handler}>
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole("tab", { name: "B" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("links each panel to its trigger via aria-controls / aria-labelledby", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );

    const triggerA = screen.getByRole("tab", { name: "A" });
    const panelA = screen.getByRole("tabpanel", { name: "A" });
    expect(triggerA.getAttribute("aria-controls")).toBe(panelA.id);
    expect(panelA.getAttribute("aria-labelledby")).toBe(triggerA.id);
  });

  it("throws if Trigger is rendered outside of <Tabs>", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TabsTrigger value="a">A</TabsTrigger>)).toThrow(
      /Tabs components must be used inside <Tabs>/,
    );
    errorSpy.mockRestore();
  });
});
