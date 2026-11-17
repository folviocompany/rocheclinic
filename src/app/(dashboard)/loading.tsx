export default function DashboardLoading() {
  return (
    <div className="page-loading" role="status" aria-label="Carregando página" aria-live="polite">
      <div className="loading-heading">
        <span className="skeleton skeleton-overline" />
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-copy" />
      </div>
      <div className="loading-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="skeleton skeleton-card" key={index} />
        ))}
      </div>
      <span className="sr-only">Carregando conteúdo…</span>
    </div>
  );
}
