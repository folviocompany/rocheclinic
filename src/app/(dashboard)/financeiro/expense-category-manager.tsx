"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createExpenseCategory, setExpenseCategoryActive } from "./actions";
export function ExpenseCategoryManager({
  categories,
}: {
  categories: Array<{ id: string; name: string; active: boolean }>;
}) {
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function create() {
    startTransition(async () => {
      const r = await createExpenseCategory({ name });
      setNotice(r.message);
      if (r.ok) setName("");
    });
  }
  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      const r = await setExpenseCategoryActive(id, active);
      setNotice(r.message);
    });
  }
  return (
    <section className="category-manager">
      <div>
        <span className="overline">CATEGORIAS</span>
        <h2>Organização dos gastos</h2>
        {notice && <p className="muted">{notice}</p>}
      </div>
      <div className="category-create">
        <input
          aria-label="Nome da nova categoria"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nova categoria"
          maxLength={80}
        />
        <Button
          type="button"
          disabled={pending || name.trim().length < 2}
          onClick={create}
        >
          Adicionar
        </Button>
      </div>
      <div className="category-list">
        {categories.length === 0 && (
          <p className="muted">Cadastre a primeira categoria de gastos.</p>
        )}
        {categories.map((c) => (
          <button
            type="button"
            key={c.id}
            className={c.active ? "" : "inactive"}
            disabled={pending}
            onClick={() => toggle(c.id, !c.active)}
          >
            {c.name}
            <small>{c.active ? "Ativa" : "Inativa"}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
