export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="container not-found-panel">
        <a className="brand" href="/">
          <span className="brand-mark"><img src="/brand/fizyoflow-mark.svg" alt="" /></span>
          <span>Fizyoflow</span>
        </a>
        <p className="eyebrow">Sayfa bulunamadı</p>
        <h1>Bu klinik vitrini şu an yayında değil.</h1>
        <p className="lead">
          Bağlantı hatalı olabilir veya klinik sayfası henüz Fizyoflow ekibi tarafından yayına alınmamış olabilir.
        </p>
        <div className="hero-actions">
          <a className="primary-action" href="/">Fizyoflow Ana Sayfa</a>
          <a className="secondary-action" href="/ornek-klinik">Örnek Klinik Vitrini</a>
        </div>
      </section>
    </main>
  );
}
