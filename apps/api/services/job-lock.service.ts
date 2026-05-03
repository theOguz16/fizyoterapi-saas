// Bu servis modulu backend tarafinda job lock.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { DataSource } from "typeorm";

export class JobLockService {
  static async withAdvisoryLock<T>(dataSource: DataSource, lockKey: string, task: () => Promise<T>) {
    const lockRow = await dataSource.query("SELECT pg_try_advisory_lock(hashtext($1)) AS locked", [lockKey]);
    const locked = Boolean(lockRow?.[0]?.locked);

    if (!locked) {
      return {
        executed: false as const,
        result: null as T | null,
      };
    }

    try {
      const result = await task();
      return {
        executed: true as const,
        result,
      };
    } finally {
      await dataSource.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]);
    }
  }
}
