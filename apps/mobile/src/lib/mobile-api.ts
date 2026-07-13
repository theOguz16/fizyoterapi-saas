// Mobil API icin geriye uyumlu ana export noktasi.
// Yeni kod domain modullerini dogrudan kullanabilir; mevcut ekran importlari kirilmaz.
export * from "./api/types";
export * from "./api/auth";
export * from "./api/public";
export * from "./api/account";
export * from "./api/member";
export * from "./api/trainer";
export * from "./api/admin";
export * from "./api/subscription";
export * from "./api/analytics";
export * from "./api/notifications";

// Eski Turkce karakterli exportlar geriye uyumluluk icin korunuyor.
export {
  getPublicSalonsApi as getPublıcSalonsApi,
  getPublicSalonApi as getPublıcSalonApi,
  getPublicSalonPackagesApi as getPublıcSalonPackagesApi,
} from "./api/public";
export {
  createSalonApplicationApi as createSalonApplıcationApi,
  getMemberMeasurementsApi as getMemberMeaşurementsApi,
  createMemberMeasurementApi as createMemberMeaşurementApi,
} from "./api/member";
export { getAdminMemberMeasurementsApi as getAdminMemberMeaşurementsApi } from "./api/admin";
export { createClinicRequestApi as createClinıcRequestApi } from "./api/account";
