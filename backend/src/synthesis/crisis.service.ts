import { Injectable } from "@nestjs/common";

const CRISIS_PATTERNS = [
  /\b(suicide|suicidal)\b/i,
  /\bkill (my|him|her|them)self\b/i,
  /\bend (my|his|her|their) life\b/i,
  /\bnot worth living\b/i,
  /\bwant to die\b/i,
  /\bcan't go on\b/i,
  /\bno reason to live\b/i,
  /\bhurt (my|him|her|them)self\b/i,
  /\bself.?harm\b/i,
];

export const CRISIS_RESPONSE = {
  insight:
    "what you shared took courage. if you are in a difficult moment right now, please reach out to someone who can be with you.",
  resources: {
    us: "988 — call or text, 24 hours",
    text: "crisis text line — text home to 741741",
    international: "findahelpline.com",
  },
  isCrisis: true,
};

@Injectable()
export class CrisisService {
  detect(text: string): boolean {
    return CRISIS_PATTERNS.some((p) => p.test(text));
  }

  get response() {
    return CRISIS_RESPONSE;
  }
}
