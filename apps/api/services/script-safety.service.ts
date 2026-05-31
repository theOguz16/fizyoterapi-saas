export class ScriptSafetyService {
  static assertNonProductionScript(scriptName: string, env: NodeJS.ProcessEnv = process.env) {
    if (env.NODE_ENV === "production") {
      throw new Error(`${scriptName} cannot run with NODE_ENV=production`);
    }
    const databaseUrl = String(env.DATABASE_URL || "").toLowerCase();
    const productionMarkers = ["prod", "production"];
    if (productionMarkers.some((marker) => databaseUrl.includes(marker)) && env.ALLOW_PRODUCTION_SCRIPT !== "true") {
      throw new Error(`${scriptName} looks pointed at a production database. Set ALLOW_PRODUCTION_SCRIPT=true only if this is intentional.`);
    }
  }
}
