export function resolveMembersEmptyState(hasSearchOrFilters: boolean) {
  if (hasSearchOrFilters) {
    return {
      title: "Aramana uygun kişi bulunamadı",
      description: "Arama ve filtreleri temizleyerek tüm kişileri yeniden görüntüleyebilirsin.",
      icon: "search" as const,
      actionLabel: "Arama ve filtreleri temizle",
      actionIcon: "search" as const,
      action: "CLEAR_FILTERS" as const,
    };
  }

  return {
    title: "İlk danışanını kliniğine davet et",
    description: "Salon QR'ını paylaş. Danışanın kayıt olduğunda üye profili ve paket süreci burada görünür.",
    icon: "qr" as const,
    actionLabel: "Danışan QR'ını aç",
    actionIcon: "qr" as const,
    action: "OPEN_QR" as const,
  };
}

export function resolvePackagesEmptyState(packageCount: number) {
  if (packageCount > 0) {
    return {
      title: "Filtreye uygun paket bulunamadı",
      description: "Arama ve durum filtresini temizleyerek bütün paketleri yeniden görüntüle.",
      icon: "search" as const,
      actionLabel: "Filtreleri temizle",
      actionIcon: "search" as const,
      action: "CLEAR_FILTERS" as const,
    };
  }

  return {
    title: "İlk paketini oluştur",
    description: "Ders türünü seçerek fiyat, süre ve kapasite bilgilerini tamamla; paketin danışan akışında görünmeye başlasın.",
    icon: "package" as const,
    actionLabel: "Paket türünü seç",
    actionIcon: "package" as const,
    action: "SELECT_PACKAGE_TYPE" as const,
  };
}

export function resolveCalendarEmptyState(hasConfiguredBusinessHours: boolean) {
  if (!hasConfiguredBusinessHours) {
    return {
      title: "Önce çalışma saatlerini ayarla",
      description: "Çalışma günleri ve saatleri kaydedildiğinde uygun takvim slotları otomatik oluşur.",
      icon: "clock" as const,
      actionLabel: "Çalışma saatlerini ayarla",
      actionIcon: "clock" as const,
      route: "/(admin)/working-hours" as const,
    };
  }

  return {
    title: "Takvimin ilk ders için hazır",
    description: "Henüz planlı ders yok. Salon QR'ını paylaşarak ilk danışan kayıt ve rezervasyon akışını başlat.",
    icon: "calendar" as const,
    actionLabel: "İlk danışanını davet et",
    actionIcon: "qr" as const,
    route: "/(admin)/clinic-qr" as const,
  };
}

export function resolveDashboardEmptyState(activeMemberCount: number) {
  if (activeMemberCount > 0) {
    return {
      title: "Şu an risk sinyali yok",
      description: "Aktif danışanlarını ve paket kullanımını üye listesinden takip edebilirsin.",
      icon: "risk" as const,
      actionLabel: "Üyeleri görüntüle",
      actionIcon: "members" as const,
      route: "/(admin)/members" as const,
    };
  }

  return {
    title: "İlk danışanınla operasyonu başlat",
    description: "Salon QR'ını paylaş. Danışanların geldikçe üyelik, paket, ders ve risk özetleri burada oluşur.",
    icon: "qr" as const,
    actionLabel: "Danışan QR'ını paylaş",
    actionIcon: "qr" as const,
    route: "/(admin)/clinic-qr" as const,
  };
}
