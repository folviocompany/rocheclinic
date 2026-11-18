"use client";

import { useState, useTransition } from "react";
import { Pencil, Repeat2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/features/finances/schema";
import type { ExpenseRecurrenceRow } from "@/features/finances/dashboard";
import { stopExpenseRecurrence, updateExpenseRecurrence } from "./actions";

type Category = { id: string; name: string; active: boolean };

export function ExpenseRecurrenceManager({
  recurrences,
  categories,
}: {
  recurrences: ExpenseRecurrenceRow[];
  categories: Category[];
}) {
  const [editing, setEditing] = useState<ExpenseRecurrenceRow | null>(null);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [responsibility, setResponsibility] = useState<"individual" | "shared">(
    "individual",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openEdit(item: ExpenseRecurrenceRow) {
    setEditing(item);
    setDescription(item.description);
    setCategoryId(item.categoryId);
    setAmount((item.amountCents / 100).toFixed(2).replace(".", ","));
    setResponsibility(item.responsibility);
    setNotice(null);
  }

  function save() {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateExpenseRecurrence({
        id: editing.id,
        description,
        categoryId,
        amount,
        responsibility,
      });
      setNotice(result.message);
      if (result.ok) setEditing(null);
    });
  }

  function stop(id: string) {
    startTransition(async () => {
      const result = await stopExpenseRecurrence(id);
      setNotice(result.message);
    });
  }

  const active = recurrences.filter((item) => item.active);
  return (
    <section className="recurrence-manager">
      <div className="recurrence-heading">
        <div>
          <span className="overline">RECORRÊNCIAS</span>
          <h2>Gastos mensais ativos</h2>
          <p>
            Altere os próximos lançamentos ou encerre a repetição sem apagar o
            histórico.
          </p>
        </div>
        <Repeat2 size={22} />
      </div>
      {notice && <p className="alert success">{notice}</p>}
      {active.length === 0 ? (
        <p className="muted recurrence-empty">Nenhum gasto recorrente ativo.</p>
      ) : (
        <div className="recurrence-list">
          {active.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.description}</strong>
                <small>
                  {formatMoney(item.amountCents)} por mês · próximo em{" "}
                  {new Date(
                    `${item.nextOccurrenceDate}T12:00:00`,
                  ).toLocaleDateString("pt-BR")}
                </small>
              </div>
              <div className="financial-account-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => openEdit(item)}
                >
                  <Pencil size={15} /> Alterar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => stop(item.id)}
                >
                  <X size={15} /> Encerrar
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <div className="recurrence-edit">
          <div className="form-row two">
            <label className="form-field">
              <span>Descrição</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={180}
              />
            </label>
            <label className="form-field">
              <span>Valor mensal</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
              />
            </label>
          </div>
          <div className="form-row two">
            <label className="form-field">
              <span>Categoria</span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                {categories
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="form-field">
              <span>Responsabilidade</span>
              <select
                value={responsibility}
                onChange={(event) =>
                  setResponsibility(
                    event.target.value as "individual" | "shared",
                  )
                }
              >
                <option value="individual">Minha despesa individual</option>
                <option value="shared">Despesa compartilhada</option>
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setEditing(null)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={pending} onClick={save}>
              Salvar próximos meses
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
