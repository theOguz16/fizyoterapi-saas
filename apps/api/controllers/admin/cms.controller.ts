// Bu controller admin tarafindaki cms.controller endpointlerinin is akisini yonetir.
// Request validation sonrasi gereken repository ve servis cagrilari burada orkestre edilir.
import { AppDataSource } from "../../data-source";
import { SalonProfile } from "../../entities/salon-profile.entity";
import { SalonImage, SalonImageType } from "../../entities/salon-image.entity";
import { AppError } from "../../errors/AppError";
import { AuditLogService } from "../../services/audit-log.service";

type CmsRequest = {
  tenantId?: string;
  auth?: { sub: string; tenantId: string; role: string };
  body?: Record<string, any>;
  params?: Record<string, string | undefined>;
  file?: {
    filename: string;
    mimetype: string;
    size: number;
    originalname: string;
  };
};

type CmsResponse = {
  status: (code: number) => CmsResponse;
  json: (payload: any) => any;
};

export class AdminCmsController {
  private static async logCmsAudit(
    req: CmsRequest,
    input: { eventType: string; targetType: string; targetId: string; metadata?: Record<string, unknown> }
  ) {
    await AuditLogService.log({
      tenant_id: req.tenantId || null,
      actor_user_id: req.auth?.sub || null,
      actor_role: req.auth?.role || null,
      event_type: input.eventType,
      action: input.eventType,
      method: "method" in (req as any) ? (req as any).method : null,
      path: "originalUrl" in (req as any) ? (req as any).originalUrl : null,
      status_code: 200,
      success: true,
      target_type: input.targetType,
      target_id: input.targetId,
      metadata: input.metadata ?? null,
    });
  }

  // --- GET /admin/cms/profile ---
  static async getProfile(req: CmsRequest, res: CmsResponse) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const profile = await AppDataSource.getRepository(SalonProfile).findOne({
        where: { tenant_id: tenantId },
      });

      if (!profile) {
        throw new AppError("PROFILE_NOT_FOUND", 404, "Profil bulunamadı");
      }

      return res.json(profile);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin CMS profil getirilirken hata:", error);
      throw new AppError("PROFILE_GET_ERROR", 500, "Profil getirilirken hata oluştu");
    }
  }

  // --- PUT /admin/cms/profile ---
  static async updateProfile(req: CmsRequest, res: CmsResponse) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
      }

      const {
        hero_title,
        hero_subtitle,
        about_text,
        why_us,
        services,
        location,
        social_links,
        theme,
        primary_color,
      } = req.body ?? {};

      let profile = await AppDataSource.getRepository(SalonProfile).findOne({
        where: { tenant_id: tenantId },
      });

      if (!profile) {
        throw new AppError("PROFILE_NOT_FOUND", 404, "Profil bulunamadı");
      }

      const profileRepo = AppDataSource.getRepository(SalonProfile);

      if (hero_title !== undefined) profile.hero_title = hero_title;
      if (hero_subtitle !== undefined) profile.hero_subtitle = hero_subtitle;
      if (about_text !== undefined) profile.about_text = about_text;
      if (why_us !== undefined) profile.why_us = why_us;
      if (services !== undefined) profile.services = services;
      if (location !== undefined) profile.location = location;
      if (social_links !== undefined) profile.social_links = social_links;
      if (theme !== undefined) profile.theme = theme;
      if (primary_color !== undefined) profile.primary_color = primary_color;

      await profileRepo.save(profile);
      await AdminCmsController.logCmsAudit(req, {
        eventType: "ADMIN_CMS_PROFILE_UPDATED",
        targetType: "salon_profile",
        targetId: profile.id,
      });

      return res.json(profile);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error("Admin CMS profil güncellenirken hata:", error);
      throw new AppError("PROFILE_UPDATE_ERROR", 500, "Profil güncellenirken hata oluştu");
    }
  }

  // --- POST /admin/cms/images ---
  // body: { type?: "HERO" | "GALLERY", sort_order?: number }
  static async uploadImage(req: CmsRequest, res: CmsResponse) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");

      // Multer route'ta çalıştıysa burada dolu olur
      if (!req.file) throw new AppError("NO_FILE", 400, "Yüklenmiş dosya bulunamadı");

      const body = req.body ?? {};
      const typeRaw = String(body.type ?? "GALLERY").toUpperCase();
      const type = typeRaw === "HERO" ? SalonImageType.HERO : SalonImageType.GALLERY;

      const sortOrder = body.sort_order === undefined ? 0 : Number(body.sort_order);

      if (Number.isNaN(sortOrder) || sortOrder < 0) {
        throw new AppError("VALIDATION_ERROR", 400, "sort_order geçersiz");
      }

      const profileRepo = AppDataSource.getRepository(SalonProfile);
      const imageRepo = AppDataSource.getRepository(SalonImage);

      const profile = await profileRepo.findOne({ where: { tenant_id: tenantId } });
      if (!profile) throw new AppError("PROFILE_NOT_FOUND", 404, "Profil bulunamadı");

      // Public URL: upload.middleware dosyayı nereye yazıyorsa onunla UYUMLU olmalı.
      // Örn middleware: uploads/tenants/<tenantId>/<hero|gallery>/<filename>
      const folder = type === SalonImageType.HERO ? "hero" : "gallery";
      const filename = req.file.filename;
      const url = `/uploads/tenants/${tenantId}/${folder}/${filename}`;

      // HERO tek olsun istiyorsan: önce eski HERO kaydını (varsa) sil
      if (type === SalonImageType.HERO) {
        const existingHero = await imageRepo.findOne({
          where: { tenant_id: tenantId, type: SalonImageType.HERO },
        });

        if (existingHero) {
          await imageRepo.remove(existingHero);
        }
      }

      const img = imageRepo.create({
        tenant_id: tenantId,
        type,
        url,
        sort_order: type === SalonImageType.GALLERY ? sortOrder : 0,
        meta: {
          mimetype: req.file.mimetype,
          size: req.file.size,
          originalname: req.file.originalname,
        },
      });

      await imageRepo.save(img);

      // HERO ise profile'a da yaz (public sayfada hızlı erişim)
      if (type === SalonImageType.HERO) {
        profile.hero_image_url = url;
        await profileRepo.save(profile);
      }
      await AdminCmsController.logCmsAudit(req, {
        eventType: "ADMIN_CMS_IMAGE_UPLOADED",
        targetType: "salon_image",
        targetId: img.id,
        metadata: { image_type: img.type, url: img.url },
      });

      return res.status(201).json({
        message: "Resim başarıyla yüklendi",
        data: {
          id: img.id,
          type: img.type,
          url: img.url,
          sort_order: img.sort_order,
          meta: img.meta,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin CMS resim yükleme hatası:", error);
      throw new AppError("IMAGE_UPLOAD_ERROR", 500, "Resim yüklenirken hata oluştu");
    }
  }

  // --- DELETE /admin/cms/images/:imageId ---
  static async deleteImage(req: CmsRequest, res: CmsResponse) {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");

      const imageId = String(req.params?.imageId ?? "").trim();
      if (!imageId) throw new AppError("NO_IMAGE_ID", 400, "Silinecek resmin ID'si gerekli");

      const imageRepo = AppDataSource.getRepository(SalonImage);
      const profileRepo = AppDataSource.getRepository(SalonProfile);

      // 1) DB kaydını bul
      const img = await imageRepo.findOne({ where: { id: imageId } });
      if (!img) throw new AppError("IMAGE_NOT_FOUND", 404, "Resim bulunamadı");

      // 2) tenant doğrulaması
      if (img.tenant_id !== tenantId) {
        // güvenlik: başka tenant'ın resmini sildirme
        throw new AppError("FORBIDDEN", 403, "Bu resim bu tenant'a ait değil");
      }

      // 3) DB'den sil
      await imageRepo.remove(img);

      // 5) HERO ise profile.hero_image_url temizle (eşleşiyorsa)
      if (img.type === SalonImageType.HERO) {
        const profile = await profileRepo.findOne({ where: { tenant_id: tenantId } });
        if (profile && profile.hero_image_url === img.url) {
          profile.hero_image_url = undefined;
          await profileRepo.save(profile);
        }
      }
      await AdminCmsController.logCmsAudit(req, {
        eventType: "ADMIN_CMS_IMAGE_DELETED",
        targetType: "salon_image",
        targetId: img.id,
        metadata: { image_type: img.type, url: img.url },
      });

      return res.json({ message: "Resim başarıyla silindi" });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("Admin CMS resim silme hatası:", error);
      throw new AppError("IMAGE_DELETE_ERROR", 500, "Resim silinirken hata oluştu");
    }
  }


  // --- GET /admin/cms/preview ---
  static async preview(req: CmsRequest, res: CmsResponse) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
    }

    let profile = await AppDataSource.getRepository(SalonProfile).findOne({
        where: { tenant_id: tenantId },
      });

      if (!profile) {
        throw new AppError("PROFILE_NOT_FOUND", 404, "Profil bulunamadı");
      }

    const previewData = profile;

    return res.json({
      tenant_id: tenantId,
      preview: previewData,
      is_published: previewData?.is_published || false,
    });
    
  }


  // --- POST /admin/cms/publish ---
  static async publish(req: CmsRequest, res: CmsResponse) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
    }

    const profileRepo = AppDataSource.getRepository(SalonProfile);
    let profile = await profileRepo.findOne({ where: { tenant_id: tenantId } });
    
    if (!profile) {
      throw new AppError("PROFILE_NOT_FOUND", 404, "Profil bulunamadı");
    }
    
    if(!profile.slug || !profile.why_us || !profile.services || !profile.location || !profile.social_links || !profile.theme || !profile.primary_color) {
      throw new AppError("VALIDATION_ERROR", 400, "Yayınlamak için tüm alanların doldurulması gerekmektedir");
    }
    profile.is_published = true;
    
    await profileRepo.save(profile);
    await AdminCmsController.logCmsAudit(req, {
      eventType: "ADMIN_CMS_PUBLISHED",
      targetType: "salon_profile",
      targetId: profile.id,
    });
    return res.json({ message: "Profil başarıyla yayınlandı", profile: profile });
  }

  // --- POST /admin/cms/unpublish ---
  static async unpublish(req: CmsRequest, res: CmsResponse) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new AppError("NO_TENANT", 400, "Tenant bilgisi bulunamadı");
    }

    const profileRepo = AppDataSource.getRepository(SalonProfile);
    let profile = await profileRepo.findOne({ where: { tenant_id: tenantId } });
    
    if (!profile) {
      throw new AppError("PROFILE_NOT_FOUND", 404, "Profil bulunamadı");
    }

    profile.is_published = false;
    await profileRepo.save(profile);
    await AdminCmsController.logCmsAudit(req, {
      eventType: "ADMIN_CMS_UNPUBLISHED",
      targetType: "salon_profile",
      targetId: profile.id,
    });

    return res.json({ message: "Profil başarıyla yayından kaldırıldı", profile: profile });
  }
}
