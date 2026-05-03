// Bu hata modulu backend'in error factory ile ilgili ortak hata modelini veya donusumunu tanimlar.
// Farkli katmanlardan gelen hatalarin tek dilde cevap uretebilmesi icin kullanilir.
import { AppError } from "./AppError";
import { messageForCode } from "./error-catalog";

export function createAppError(code: string, statusCode: number, fallbackMessage: string) {
  return new AppError(code, statusCode, messageForCode(code, fallbackMessage));
}
