// Bu helper modulu mobil tarafta member home ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
export function formatMemberHomeDate(value?: string | null) {
  if (!value) return "Belirtilmedi";
  return new Date(value).toLocaleString("tr-TR");
}

export function getCancellationState(startsAt?: string | null, minHours = 3, now = Date.now()) {
  if (!startsAt) {
    return {
      label: "İptal bilgisi yok",
      canCancel: false,
    };
  }

  const diff = new Date(startsAt).getTime() - now;
  const canCancel = diff >= minHours * 60 * 60 * 1000;

  return {
    label: canCancel ? "İptal edilebilir" : "İptal süresi doldu",
    canCancel,
  };
}

export function buildMemberMomentum(data: any) {
  const weeklyTarget = Number(data?.lesson_usage?.weekly_target || 1);
  const attended = Number(data?.lesson_usage?.attended_this_week || 0);
  const totalAttendance = Number(data?.attendance_summary?.total || attended || 0);
  const streak = Math.max(1, Math.min(14, attended + (totalAttendance > 6 ? 2 : 1)));
  const weeklyScore = Math.max(10, Math.min(100, Math.round((attended / Math.max(1, weeklyTarget)) * 100)));
  const level = Math.max(1, Math.min(9, Math.floor(totalAttendance / 6) + 1));

  return {
    streak,
    weeklyScore,
    level,
    petName: level >= 5 ? "Mavi Balina" : "Minik Koala",
    rewardLabel: weeklyScore >= 100 ? "Parilti rozeti" : "Devam bonusu",
  };
}
