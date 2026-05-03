// Bu hata modulu backend'in AppError ile ilgili ortak hata modelini veya donusumunu tanimlar.
// Farkli katmanlardan gelen hatalarin tek dilde cevap uretebilmesi icin kullanilir.
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}