import { Criterion } from "@/types/models";

export const CRITERIA: Criterion[] = [
  {
    id: "timeline",
    key: "timeline",
    name: "לוח זמנים מחייב",
    description: "הגדרת תאריכים מחייבים, חלונות זמן ו-SLA לחריגות",
    colorVar: "--crit-timeline",
    weight: 17,
  },
  {
    id: "integrator",
    key: "integrator",
    name: "צוות מתכלל",
    description: "קיום גוף מוביל, הרכב, סמכויות, תדירות והסרת חסמים",
    colorVar: "--crit-integrator",
    weight: 10,
  },
  {
    id: "reporting",
    key: "reporting",
    name: "מנגנון דיווח/בקרה",
    description: "יעדי דיווח, תדירות, פורמט, וטיפול בסטיות",
    colorVar: "--crit-reporting",
    weight: 9,
  },
  {
    id: "evaluation",
    key: "evaluation",
    name: "מדידה והערכה",
    description: "מדדים, מתודולוגיה, גוף מבצע, תדירות ושימוש בתובנות",
    colorVar: "--crit-evaluation",
    weight: 7,
  },
  {
    id: "external_audit",
    key: "external_audit",
    name: "ביקורת חיצונית",
    description: "גוף חיצוני, מועד, חובת פרסום וסטטוס מחייב",
    colorVar: "--crit-external-audit",
    weight: 4,
  },
  {
    id: "resources",
    key: "resources",
    name: "משאבים נדרשים",
    description: "סכומים, מקורות, חלוקה, כוח אדם והתניות תקציב",
    colorVar: "--crit-resources",
    weight: 19,
  },
  {
    id: "multi_levels",
    key: "multi_levels",
    name: "מעורבות מספר דרגים",
    description: "פירוט מדיני/מקצועי/ביצועי ונהלי תיאום",
    colorVar: "--crit-multi-levels",
    weight: 7,
  },
  {
    id: "structure",
    key: "structure",
    name: "מבנה סעיפים וחלוקת עבודה",
    description: "אחריות ברורה ואבני דרך",
    colorVar: "--crit-structure",
    weight: 9,
  },
  {
    id: "field_implementation",
    key: "field_implementation",
    name: "יישום בשטח",
    description: "מי/איך/סמכויות/פיקוח/מסגרת התקשרות",
    colorVar: "--crit-field-implementation",
    weight: 9,
  },
  {
    id: "arbitrator",
    key: "arbitrator",
    name: "גורם מכריע",
    description: "זהות המכריע, SLA להכרעה וחומרי רקע",
    colorVar: "--crit-arbitrator",
    weight: 3,
  },
  {
    id: "cross_sector",
    key: "cross_sector",
    name: "שותפות בין‑מגזרית",
    description: "מי/מתי/למה ומנגנון שיתוף ציבור",
    colorVar: "--crit-cross-sector",
    weight: 3,
  },
  {
    id: "outcomes",
    key: "outcomes",
    name: "מדדי תוצאה והצלחה",
    description: "יעד מספרי/זמן/שיטת מדידה/ספי הצלחה",
    colorVar: "--crit-outcomes",
    weight: 3,
  },
];

export const CRITERIA_MAP: Record<string, Criterion> = Object.fromEntries(
  CRITERIA.map((c) => [c.id, c])
);
