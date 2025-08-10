import { Criterion } from "@/types/models";

export const CRITERIA: Criterion[] = [
  {
    id: "legal",
    key: "legal",
    name: "מסגרת משפטית",
    description: "בדיקת עמידה בדין, סמכויות, תקנות וחוקי יסוד",
    colorVar: "--crit-legal",
  },
  {
    id: "budget",
    key: "budget",
    name: "השלכות תקציביות",
    description: "השפעה על התקציב, עלויות, מימון ומקורות תקציביים",
    colorVar: "--crit-budget",
  },
  {
    id: "stakeholders",
    key: "stakeholders",
    name: "בעלי עניין",
    description: "השלכות על ציבור, משרדים, רשויות וגורמים נוספים",
    colorVar: "--crit-stakeholders",
  },
];

export const CRITERIA_MAP: Record<string, Criterion> = Object.fromEntries(
  CRITERIA.map((c) => [c.id, c])
);
