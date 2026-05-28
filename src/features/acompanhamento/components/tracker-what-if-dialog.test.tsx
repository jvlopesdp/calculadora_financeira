import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TrackerWhatIfDialog } from "@/features/acompanhamento/components/tracker-what-if-dialog";
import { buildCurves } from "@/features/acompanhamento/lib/build-curves";
import type { TrackerEntryApi, TrackerPlanApi } from "@/lib/api-client";

const upsertMutateAsync = vi.fn();
vi.mock("@/lib/queries/tracker-plans", () => ({
  useUpsertTrackerEntry: () => ({
    mutateAsync: upsertMutateAsync,
    isPending: false,
  }),
}));

// Passthrough Dialog so the form renders when `open` is true (no Radix portal).
vi.mock("@/components/ui/dialog", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  );
  return {
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <div role="dialog">{children}</div> : null,
    DialogContent: Passthrough,
    DialogHeader: Passthrough,
    DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: Passthrough,
    DialogFooter: Passthrough,
    DialogClose: Passthrough,
    DialogTrigger: Passthrough,
  };
});

function makePlan(overrides: Partial<TrackerPlanApi> = {}): TrackerPlanApi {
  return {
    id: "tp_1",
    user_id: "u_1",
    name: "Apartamento Centro",
    property_value_cents: 120_000_00,
    down_payment_cents: 0,
    term_months: 12,
    annual_rate_bp: 1200,
    modality: "PRICE",
    start_date: "2025-01-01",
    target_monthly_total_cents: 10_000_00,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_000_000,
    ...overrides,
  };
}

function renderDialog(entries: TrackerEntryApi[] = []) {
  const plan = makePlan();
  const curves = buildCurves(plan, entries);
  const onOpenChange = vi.fn();
  render(
    <TrackerWhatIfDialog
      open
      onOpenChange={onOpenChange}
      plan={plan}
      curves={curves}
    />,
  );
  return { plan, curves, onOpenChange };
}

describe("TrackerWhatIfDialog", () => {
  beforeEach(() => {
    upsertMutateAsync.mockReset();
  });

  it("shows the result cards when the simulated value beats the installment", () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "60000" },
    });

    const result = screen.getByTestId("tracker-what-if-result");
    expect(
      within(result).getByText("Nova data de quitação"),
    ).toBeInTheDocument();
    expect(within(result).getByText("Juros economizados")).toBeInTheDocument();
    expect(
      within(result).getByText("Parcelas economizadas"),
    ).toBeInTheDocument();
    // A big month-1 payment cuts the term, so months are saved vs Normal.
    expect(
      within(result).getByText(/antes do previsto/),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("tracker-what-if-below-installment"),
    ).not.toBeInTheDocument();
  });

  it("blocks values below the scheduled installment with a message", () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "100" },
    });

    expect(
      screen.getByTestId("tracker-what-if-below-installment"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("tracker-what-if-result"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Aplicar este lançamento" }),
    ).toBeDisabled();
  });

  it("applies the simulated entry via the upsert mutation and closes", async () => {
    upsertMutateAsync.mockResolvedValue({});
    const { onOpenChange } = renderDialog();

    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "60000" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Aplicar este lançamento" }),
    );

    await waitFor(() => {
      expect(upsertMutateAsync).toHaveBeenCalledWith({
        month_index: 1,
        paid_amount: 60000,
        paid_at: "2025-01-01",
        apply_mode: "reduce_term",
      });
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("does not call the mutation when the value is below the installment", () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "100" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Aplicar este lançamento" }),
    );

    expect(upsertMutateAsync).not.toHaveBeenCalled();
  });
});
