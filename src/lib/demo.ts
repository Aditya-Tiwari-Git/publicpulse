import type { AppData, ResponseRecord } from "../types";
import { defaultSurvey, issues, incomeBands } from "./template.ts";
import { publishSurvey } from "./engine.ts";
export const demoAdmin = {
  id: "demo-admin",
  username: "admin",
  name: "Aditya Sharma",
  role: "admin" as const,
  active: true,
  must_change_password: false,
};
export const places = [
  ["Maharashtra", "Pune", "Mumbai", "Nagpur"],
  ["Uttar Pradesh", "Lucknow", "Varanasi", "Kanpur"],
  ["Karnataka", "Bengaluru", "Mysuru", "Belagavi"],
  ["Rajasthan", "Jaipur", "Jodhpur", "Udaipur"],
  ["Tamil Nadu", "Chennai", "Coimbatore", "Madurai"],
  ["Gujarat", "Ahmedabad", "Surat", "Vadodara"],
];
export function generateDemo(count = 864, seed = 2026): AppData {
  let s = seed;
  const random = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const pick = <T>(a: T[]) => a[Math.floor(random() * a.length)];
  const base = defaultSurvey();
  base.created_at = "2026-09-01T09:00:00Z";
  const survey = publishSurvey(base);
  const second = publishSurvey({
    ...structuredClone(base),
    id: crypto.randomUUID(),
    title: "Urban Mobility & Public Transport",
    description: "A closer look at how our cities move.",
    published: [],
  });
  const third = {
    ...structuredClone(base),
    id: crypto.randomUUID(),
    title: "Rural Livelihoods & Essential Services",
    description: "Listening to the needs of rural communities.",
    status: "draft" as const,
    published: [],
  };
  const profiles = [
    demoAdmin,
    ...[
      "Priya Mehta",
      "Rahul Singh",
      "Ananya Rao",
      "Vikram Patel",
      "Sneha Iyer",
      "Arjun Kumar",
    ].map((name, i) => ({
      id: `demo-surveyor-${i}`,
      username: `field${i + 1}`,
      name,
      role: "surveyor" as const,
      active: true,
      must_change_password: false,
    })),
  ];
  const now = new Date();
  const responses: ResponseRecord[] = Array.from({ length: count }, (_, i) => {
    const p = pick(places),
      date = new Date(now);
    date.setDate(date.getDate() - Math.floor(random() * 30));
    date.setHours(8 + Math.floor(random() * 11), Math.floor(random() * 60));
    const issue = pick(issues.slice(0, random() > 0.3 ? 8 : 12));
    return {
      id: `synthetic-${seed}-${i}`,
      survey_id: i % 5 === 0 ? second.id : survey.id,
      version: 1,
      surveyor_id: pick(profiles.slice(1)).id,
      created_at: date.toISOString(),
      geography: p[0],
      state: p[0],
      district: pick(p.slice(1)),
      mode: "In person",
      consent: true,
      status: "completed",
      synthetic: true,
      validation_status: "valid",
      sync_status: "synced",
      answers: {
        consent: "I agree to participate",
        state: p[0],
        district: p[1],
        issues: [issue, pick(issues.filter((x) => x !== issue))],
        priority: issue,
        severity: pick([
          "Moderately serious",
          "Very serious",
          "Extremely serious",
          "Slightly serious",
        ]),
        satisfaction: pick([
          "Very satisfied",
          "Somewhat satisfied",
          "Somewhat satisfied",
          "Neither",
          "Somewhat dissatisfied",
          "Very dissatisfied",
        ]),
        age: pick(["18–24", "25–34", "35–44", "45–54", "55–64", "65+"]),
        income: pick(incomeBands),
        occupation: pick([
          "Student",
          "Salaried",
          "Self-employed",
          "Farmer",
          "Daily-wage worker",
          "Homemaker",
          "Retired",
        ]),
        rural_urban: pick(["Rural", "Urban"]),
        change: pick(["Improved", "Remained the same", "Worsened"]),
        other_issue: pick([
          "Roads need repair",
          "Clean drinking water",
          "स्थानीय रोज़गार की कमी",
          "Better bus frequency",
          "",
        ]),
      },
    };
  });
  const geographies = places.flatMap((p, i) => [
    { id: `state-${i}`, name: p[0], level: "state", parent_id: null },
    ...p.slice(1).map((name, j) => ({
      id: `district-${i}-${j}`,
      name,
      level: "district",
      parent_id: `state-${i}`,
    })),
  ]);
  return {
    surveys: [survey, second, third],
    responses,
    profiles,
    geographies,
    assignments: profiles.slice(1).flatMap((p) =>
      [survey, second].map((s) => ({
        id: crypto.randomUUID(),
        survey_id: s.id,
        surveyor_id: p.id,
        quota: 200,
      })),
    ),
    dashboards: [
      {
        id: "overview",
        title: "Community overview",
        published: true,
        widgets: [
          {
            id: "w1",
            title: "Priority issues",
            type: "horizontal",
            metric: "priority",
            width: "half",
            aggregation: "count",
          },
          {
            id: "w2",
            title: "Public service satisfaction",
            type: "donut",
            metric: "satisfaction",
            width: "half",
            aggregation: "count",
          },
        ],
      },
    ],
    classifiers: [
      {
        id: "roads",
        category: "Roads",
        keywords: ["road", "pothole", "सड़क", "गड्ढ"],
      },
      {
        id: "water",
        category: "Water",
        keywords: ["water", "drinking", "पानी", "जल"],
      },
      {
        id: "jobs",
        category: "Employment",
        keywords: ["job", "employment", "रोज़गार", "नौकरी"],
      },
      {
        id: "transport",
        category: "Public transport",
        keywords: ["bus", "transport", "बस", "परिवहन"],
      },
    ],
    audit: [
      {
        id: "seed",
        actor: "System",
        action: "Synthetic research workspace initialized (seed 2026)",
        created_at: now.toISOString(),
      },
    ],
    settings: {
      minSample: 5,
      organization: "PublicPulse Research",
      incomeBands,
    },
  };
}
