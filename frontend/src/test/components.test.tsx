import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForecastDetail } from "@/components/ForecastDetail";
import { ProbabilityColumns } from "@/components/charts/charts";
import { ErrorState, RiskBadge, useApi } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { forecast } from "./fixtures";

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("surfaces backend error messages and request ids", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "http_error", message: "job not found", request_id: "rid123456" } }), { status: 404 }));
    await expect(api("/analysis/jobs/x")).rejects.toMatchObject({ status: 404, message: "job not found", requestId: "rid123456" });
  });

  it("includes validation details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ error: { message: "request validation failed", details: [{ msg: "row 0: expected 37 features" }] } }), { status: 422 }));
    await expect(api("/forecast")).rejects.toThrow(/expected 37 features/);
  });

  it("reports network failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    await expect(api("/health")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("RiskBadge", () => {
  it("always shows the level as text, not colour alone", () => {
    render(<RiskBadge level="CRITICAL" score={91} />);
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    expect(screen.getByText("91")).toBeInTheDocument();
  });
});

describe("ForecastDetail", () => {
  it("keeps probability, risk and confidence separate and flags uncertainty", () => {
    render(<ForecastDetail fc={forecast} />);
    expect(screen.getByText("Attack probability")).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
    expect(screen.getByText("Compromise probability")).toBeInTheDocument();
    expect(screen.getByText("Risk score")).toBeInTheDocument();
    expect(screen.getByText("Model confidence")).toBeInTheDocument();
    expect(screen.getByText("uncertain")).toBeInTheDocument();
    expect(screen.getByText("early warning")).toBeInTheDocument();
    expect(screen.queryByText("outside training distribution")).not.toBeInTheDocument();
  });

  it("renders one column per forecast step with an 'actual' row when ground truth exists", () => {
    const { container } = render(<ProbabilityColumns steps={forecast.steps} truth={forecast.ground_truth!.states} />);
    expect(screen.getByText("now")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("actual")).toBeInTheDocument();
    expect(container.querySelectorAll("text").length).toBeGreaterThan(5);
    // uncertain step is marked
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});

function Probe({ path }: { path: string }) {
  const { data, error, loading } = useApi<{ status: string }>(path);
  if (loading) return <p>loading</p>;
  if (error) return <ErrorState error={error} />;
  return <p>{data?.status}</p>;
}

describe("useApi", () => {
  it("goes loading -> data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
    render(<Probe path="/health" />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("ok")).toBeInTheDocument());
  });

  it("goes loading -> error state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "model not loaded" } }), { status: 503 }));
    render(<Probe path="/ready" />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("model not loaded"));
  });
});
