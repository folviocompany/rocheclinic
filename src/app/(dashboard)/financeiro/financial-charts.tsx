"use client";

import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/features/finances/schema";
import type {
  FinancialDashboardViewModel,
  FinancialRegime,
} from "@/features/finances/dashboard";

export function FinancialCharts({
  daily,
  professionals,
  regime,
}: Pick<FinancialDashboardViewModel, "daily" | "professionals"> & {
  regime: FinancialRegime;
}) {
  return (
    <div className="finance-charts">
      <section className="chart-card">
        <div className="chart-heading">
          <div>
            <span className="overline">MOVIMENTAÇÃO</span>
            <h2>
              {regime === "cash"
                ? "Valores recebidos e pagos"
                : "Ganhos e gastos lançados"}
            </h2>
          </div>
          <span>Valores em R$</span>
        </div>
        {daily.some((item) => item.revenue || item.expense) ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient
                  id="revenueGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#B66F8B" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#B66F8B" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#eee3e8"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#8b7580" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) => `${value / 1000}k`}
                tick={{ fontSize: 10, fill: "#8b7580" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Ganhos"
                stroke="#B66F8B"
                fill="url(#revenueGradient)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Gastos"
                stroke="#9E5D5D"
                fill="transparent"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmpty />
        )}
      </section>
      <section className="chart-card">
        <div className="chart-heading">
          <div>
            <span className="overline">POR PROFISSIONAL</span>
            <h2>Participação no período</h2>
          </div>
        </div>
        {professionals.some(
          (item) => item.revenue || item.received || item.expense,
        ) ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={professionals}
              layout="vertical"
              margin={{ left: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#eee3e8"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={(value) => `${value / 1000}k`}
                tick={{ fontSize: 10, fill: "#8b7580" }}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={78}
                tick={{ fontSize: 11, fill: "#684454" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              <Bar
                dataKey={regime === "cash" ? "received" : "revenue"}
                name={regime === "cash" ? "Recebido" : "Lançado"}
                fill="#B66F8B"
                radius={[0, 5, 5, 0]}
              />
              <Bar
                dataKey="expense"
                name="Gastos"
                fill="#D9B0B0"
                radius={[0, 5, 5, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmpty />
        )}
      </section>
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="chart-empty">
      <TrendingUp size={27} />
      <p>Os gráficos aparecerão após os primeiros lançamentos do período.</p>
    </div>
  );
}
