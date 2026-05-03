type SalonMaintenancePageProps = {
  params: { salonSlug: string };
};

export default function SalonMaintenancePage({ params }: SalonMaintenancePageProps) {
  return (
    <main className="container" style={{ padding: "32px 0 44px" }}>
      <section className="hero">
        <h1 style={{ margin: 0 }}>Salon Web Sayfası Geçici Olarak Kapalı</h1>
        <p className="muted">
          <strong>{params.salonSlug}</strong> için public website yayını bu sprintte durduruldu.
          Bu alan daha sonra yeniden açılacak.
        </p>
      </section>
    </main>
  );
}

