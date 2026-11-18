"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  FinancialDashboardViewModel,
  FinancialRegime,
} from "@/features/finances/dashboard";

const FinancialCharts = dynamic(
  () => import("./financial-charts").then((module) => module.FinancialCharts),
  {
    loading: () => <ChartsPlaceholder />,
  },
);

export function DeferredFinancialCharts(
  props: Pick<FinancialDashboardViewModel, "daily" | "professionals"> & {
    regime: FinancialRegime;
  },
) {
  const anchor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!anchor.current || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(anchor.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={anchor}>
      {visible ? <FinancialCharts {...props} /> : <ChartsPlaceholder />}
    </div>
  );
}

function ChartsPlaceholder() {
  return (
    <div className="finance-charts" aria-label="Carregando gráficos">
      <section className="chart-card chart-placeholder">
        <span className="skeleton" />
      </section>
      <section className="chart-card chart-placeholder">
        <span className="skeleton" />
      </section>
    </div>
  );
}
