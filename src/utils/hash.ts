import { createHash } from "crypto";

export function createContentHash(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

export function slugifyRelativePath(relativePath: string): string {
  return relativePath.replace(/[\\/:*?"<>|]+/g, "__").replace(/\s+/g, "_");
}
