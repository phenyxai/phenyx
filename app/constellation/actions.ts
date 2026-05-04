"use server";

import { decrypt } from "@/lib/encryption";

export async function decryptInsight(encryptedPayload: string): Promise<string> {
  try {
    return decrypt(encryptedPayload);
  } catch {
    return "";
  }
}

export async function decryptReflection(encryptedPayload: string): Promise<string> {
  try {
    return decrypt(encryptedPayload);
  } catch {
    return "";
  }
}
