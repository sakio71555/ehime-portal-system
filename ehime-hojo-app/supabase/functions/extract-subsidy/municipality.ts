import { EHIME_MUNICIPALITY_BY_HOST } from "./constants.ts";

export const inferEhimeAreaFromUrl = (url: string) => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "pref.ehime.jp") {
      return {
        prefecture: "愛媛県",
        municipality: "",
        organization: "愛媛県",
        region_text: "愛媛",
      };
    }

    const municipality = EHIME_MUNICIPALITY_BY_HOST[host];

    if (municipality) {
      return {
        prefecture: "愛媛県",
        municipality,
        organization: municipality,
        region_text: "愛媛",
      };
    }

    return null;
  } catch {
    return null;
  }
};