// Bu servis modulu backend tarafinda member credit wallet.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import { EntityManager } from "typeorm";
import { AppDataSource } from "../data-source";
import { CreditLedger, CreditLedgerSource } from "../entities/credit-ledger.entity";
import { MemberCreditWallet } from "../entities/member-credit-wallet.entity";

export class MemberCreditWalletService {
  private static walletRepo(manager?: EntityManager) {
    return (manager ?? AppDataSource.manager).getRepository(MemberCreditWallet);
  }

  private static ledgerRepo(manager?: EntityManager) {
    return (manager ?? AppDataSource.manager).getRepository(CreditLedger);
  }

  static async ensureWallet(tenantId: string, memberId: string, manager?: EntityManager) {
    const repo = MemberCreditWalletService.walletRepo(manager);

    let wallet = await repo.findOne({
      where: {
        tenant_id: tenantId,
        member_id: memberId,
      },
    });

    if (!wallet) {
      wallet = repo.create({
        tenant_id: tenantId,
        member_id: memberId,
        referral_group_credits: 0,
      });

      await repo.save(wallet);
    }

    return wallet;
  }

  static async addCredits(params: {
    tenantId: string;
    memberId: string;
    amount: number;
    source: CreditLedgerSource;
    referenceType?: string;
    referenceId?: string;
    meta?: Record<string, unknown>;
  }) {
    const { tenantId, memberId, amount, source, referenceType, referenceId, meta } = params;
    const normalizedAmount = Math.max(0, Math.floor(amount));

    return AppDataSource.transaction(async (manager) => {
      const walletRepo = MemberCreditWalletService.walletRepo(manager);
      const ledgerRepo = MemberCreditWalletService.ledgerRepo(manager);

      let wallet = await walletRepo.findOne({
        where: {
          tenant_id: tenantId,
          member_id: memberId,
        },
        lock: {
          mode: "pessimistic_write",
        },
      });

      if (!wallet) {
        wallet = walletRepo.create({
          tenant_id: tenantId,
          member_id: memberId,
          referral_group_credits: 0,
        });

        await walletRepo.save(wallet);
      }

      wallet.referral_group_credits += normalizedAmount;
      await walletRepo.save(wallet);

      const ledger = ledgerRepo.create({
        tenant_id: tenantId,
        member_id: memberId,
        delta: normalizedAmount,
        balance_after: wallet.referral_group_credits,
        source,
        reference_type: referenceType,
        reference_id: referenceId,
        meta: meta ?? {},
      });

      await ledgerRepo.save(ledger);

      return { wallet, ledger };
    });
  }

  static async consumeOneCredit(params: {
    tenantId: string;
    memberId: string;
    source: CreditLedgerSource;
    referenceType?: string;
    referenceId?: string;
    meta?: Record<string, unknown>;
  }) {
    return AppDataSource.transaction(async (manager) => {
      return MemberCreditWalletService.consumeOneCreditWithManager(manager, params);
    });
  }

  static async consumeOneCreditWithManager(
    manager: EntityManager,
    params: {
      tenantId: string;
      memberId: string;
      source: CreditLedgerSource;
      referenceType?: string;
      referenceId?: string;
      meta?: Record<string, unknown>;
    }
  ) {
    const { tenantId, memberId, source, referenceType, referenceId, meta } = params;
    const walletRepo = MemberCreditWalletService.walletRepo(manager);
    const ledgerRepo = MemberCreditWalletService.ledgerRepo(manager);

    let wallet = await walletRepo.findOne({
      where: {
        tenant_id: tenantId,
        member_id: memberId,
      },
      lock: {
        mode: "pessimistic_write",
      },
    });

    if (!wallet) {
      wallet = walletRepo.create({
        tenant_id: tenantId,
        member_id: memberId,
        referral_group_credits: 0,
      });

      await walletRepo.save(wallet);
    }

    if (wallet.referral_group_credits < 1) {
      return { consumed: false as const, wallet, ledger: null };
    }

    wallet.referral_group_credits -= 1;
    await walletRepo.save(wallet);

    const ledger = ledgerRepo.create({
      tenant_id: tenantId,
      member_id: memberId,
      delta: -1,
      balance_after: wallet.referral_group_credits,
      source,
      reference_type: referenceType,
      reference_id: referenceId,
      meta: meta ?? {},
    });

    await ledgerRepo.save(ledger);

    return { consumed: true as const, wallet, ledger };
  }

  static async getCredits(tenantId: string, memberId: string) {
    const wallet = await MemberCreditWalletService.ensureWallet(tenantId, memberId);
    return wallet.referral_group_credits;
  }
}
