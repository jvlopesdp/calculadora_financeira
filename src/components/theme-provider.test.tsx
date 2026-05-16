import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/components/theme-provider";
import { useTheme } from "@/components/theme-context";

type MediaQueryListener = (event: MediaQueryListEvent) => void;

type FakeMediaQueryList = {
  matches: boolean;
  media: string;
  onchange: MediaQueryListener | null;
  addEventListener: (type: "change", listener: MediaQueryListener) => void;
  removeEventListener: (type: "change", listener: MediaQueryListener) => void;
  addListener: (listener: MediaQueryListener) => void;
  removeListener: (listener: MediaQueryListener) => void;
  dispatchEvent: (event: Event) => boolean;
};

function setupMatchMedia(prefersDark: boolean): {
  triggerChange: (matches: boolean) => void;
  mql: FakeMediaQueryList;
} {
  const listeners = new Set<MediaQueryListener>();
  const mql: FakeMediaQueryList = {
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    dispatchEvent: () => true,
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn((_query: string) => mql),
  );
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (_query: string) => mql,
  });
  return {
    mql,
    triggerChange: (matches: boolean) => {
      mql.matches = matches;
      const event = { matches } as MediaQueryListEvent;
      for (const l of listeners) l(event);
    },
  };
}

function Probe() {
  const { theme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setTheme("light")}>set-light</button>
      <button onClick={() => setTheme("dark")}>set-dark</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove("dark");
  });

  it("starts in light mode when prefers-color-scheme is light", () => {
    setupMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("starts in dark mode when prefers-color-scheme is dark", () => {
    setupMatchMedia(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggles theme and updates the 'dark' class on documentElement", async () => {
    setupMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    const toggle = screen.getByText("toggle");

    act(() => {
      toggle.click();
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      toggle.click();
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("follows the OS preference until user overrides", () => {
    const { triggerChange } = setupMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");

    act(() => {
      triggerChange(true);
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");

    act(() => {
      screen.getByText("set-light").click();
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("light");

    act(() => {
      triggerChange(true);
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("setTheme switches to the exact requested mode", () => {
    setupMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => {
      screen.getByText("set-dark").click();
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      screen.getByText("set-light").click();
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("throws when useTheme is used outside of provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
    errorSpy.mockRestore();
  });
});
