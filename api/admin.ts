import { TRPCError } from "@trpc/server";
import { env } from "./lib/env";

export function isAdminKey(key: string) {
  return env.adminKey.length > 0 && key === env.adminKey;
}

export function assertAdmin(key: string) {
  if (!env.adminKey) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "服务端未配置 ADMIN_KEY" });
  }
  if (!isAdminKey(key)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "管理口令不正确" });
  }
}
