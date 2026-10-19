import type { Question, Survey, Rule } from "../types";
import { hindiOptions } from "./translations.ts";

export const issues = [
  "Roads", "Water", "Electricity", "Employment", "Healthcare", "Education",
  "Sanitation", "Public transport", "Cost of living", "Agriculture", "Safety", "Other",
];
export const incomeBands = [
  "Below ₹10,000", "₹10,000–25,000", "₹25,001–50,000", "₹50,001–1,00,000",
  "Above ₹1,00,000", "Prefer not to say",
];
const q = (id: string, label: string, hi: string, type: Question["type"], section: string,
  options?: string[], required = false, extra: Partial<Question> = {}): Question =>
  ({ id, label, hi, type, section, options, required, ...extra });

/** Editable bilingual starter template. Existing published survey snapshots remain unchanged. */
export function defaultSurvey(configuredIncomeBands: string[] = incomeBands): Survey {
  const questions: Question[] = [
    q("consent", "May I ask a few questions about public services in your area?", "क्या मैं आपके क्षेत्र की सार्वजनिक सेवाओं के बारे में कुछ प्रश्न पूछ सकता/सकती हूँ?", "single", "Consent", ["I agree to participate", "I decline"], true,
      { help: "Participation is voluntary. Answers are used for local public-service research. No name or phone number is requested by default. / भागीदारी स्वैच्छिक है। उत्तर स्थानीय सार्वजनिक सेवाओं के शोध के लिए हैं। सामान्यतः नाम या फ़ोन नंबर नहीं माँगा जाता।" }),
    q("state", "State or Union Territory", "राज्य या केंद्र शासित प्रदेश", "geography", "Your area", undefined, true),
    q("district", "District", "ज़िला", "geography", "Your area", undefined, true),
    q("rural_urban", "Is this area rural or urban?", "यह क्षेत्र ग्रामीण है या शहरी?", "single", "Your area", ["Rural", "Urban", "Not sure"]),
    q("issues", "What are the biggest problems in your area? Choose up to three.", "आपके क्षेत्र की सबसे बड़ी समस्याएँ क्या हैं? अधिकतम तीन चुनें।", "multi", "Local issues", issues, true, { min: 1, max: 3 }),
    q("priority", "Which one needs attention most urgently?", "किस समस्या पर सबसे तुरंत ध्यान देने की ज़रूरत है?", "single", "Local issues", [...issues, "Undecided / Don't know"], true),
    q("roads_detail", "What road issue have you experienced?", "सड़क से जुड़ी कौन-सी समस्या आपने देखी है?", "multi", "Local issues", ["Potholes", "Damaged roads", "Construction delays", "Street lighting", "Traffic congestion", "Other"]),
    q("water_detail", "What water issue have you experienced?", "पानी से जुड़ी कौन-सी समस्या आपने देखी है?", "multi", "Local issues", ["Shortage", "Water quality", "Irregular supply", "Drainage", "Other"]),
    q("employment_detail", "What is the main employment concern?", "रोज़गार से जुड़ी मुख्य चिंता क्या है?", "single", "Local issues", ["Lack of local jobs", "Low wages", "Skills or training", "Other"]),
    q("severity", "How serious is the most urgent problem?", "सबसे तात्कालिक समस्या कितनी गंभीर है?", "rating", "Local issues", ["1", "2", "3", "4", "5"], true, { min: 1, max: 5 }),
    q("satisfaction", "Overall, how satisfied are you with local public services?", "कुल मिलाकर, आप स्थानीय सार्वजनिक सेवाओं से कितने संतुष्ट हैं?", "single", "Public services", ["Very satisfied", "Somewhat satisfied", "Neither satisfied nor dissatisfied", "Somewhat dissatisfied", "Very dissatisfied", "Undecided / Don't know"]),
    q("service_priority", "Which local public service needs the most improvement?", "किस स्थानीय सार्वजनिक सेवा में सबसे अधिक सुधार की ज़रूरत है?", "dropdown", "Public services", ["Roads", "Water supply", "Electricity", "Healthcare", "Education", "Sanitation", "Public transport", "Other", "None of these", "Undecided / Don't know"]),
    q("change", "Over the last 1–2 years, have things in your area improved, worsened, or stayed about the same?", "पिछले 1–2 वर्षों में आपके क्षेत्र की स्थिति बेहतर हुई है, बिगड़ी है या लगभग वैसी ही रही है?", "single", "Public services", ["Improved", "Worsened", "Stayed about the same", "Undecided / Don't know"]),
    q("aware", "Do you know who your current MLA or local public representative is?", "क्या आप जानते हैं कि आपके वर्तमान विधायक या स्थानीय जनप्रतिनिधि कौन हैं?", "single", "Representation (optional)", ["Yes", "No", "Not sure"]),
    q("current_rep", "Who is your current MLA or local public representative?", "आपके वर्तमान विधायक या स्थानीय जनप्रतिनिधि कौन हैं?", "short", "Representation (optional)", undefined, false, { max: 160 }),
    q("representative_rating", "How would you rate their work on local issues?", "स्थानीय समस्याओं पर उनके काम को आप कैसी रेटिंग देंगे?", "rating", "Representation (optional)", ["1", "2", "3", "4", "5"], false, { min: 1, max: 5, help: "Optional opinion question. / वैकल्पिक राय संबंधी प्रश्न।" }),
    q("desired_change", "What is one change you would most like to see in your area? (Optional)", "आप अपने क्षेत्र में कौन-सा एक बदलाव सबसे अधिक देखना चाहेंगे? (वैकल्पिक)", "long", "Your priorities", undefined, false, { max: 1000 }),
  ];
  for (const question of questions) if (question.options) question.optionsHi = question.options.map((o) => hindiOptions[o] || o);
  // Kept configurable for workspaces that choose to add demographics later.
  void configuredIncomeBands;
  const rules: Rule[] = [
    ...["Roads", "Water", "Employment"].map((issue, i) => ({
      id: `branch-${i}`, logic: "AND" as const,
      conditions: [{ question: "priority", operator: "equals" as const, value: issue }],
      action: "show" as const,
      target: ["roads_detail", "water_detail", "employment_detail"][i],
    })),
    { id: "rep-known", logic: "AND", conditions: [{ question: "aware", operator: "equals", value: "Yes" }], action: "show", target: "current_rep" },
    { id: "rep-rating", logic: "AND", conditions: [{ question: "aware", operator: "equals", value: "Yes" }], action: "show", target: "representative_rating" },
  ];
  return {
    id: crypto.randomUUID(), title: "Public Opinion & Local Issues Survey — India",
    description: "A short, voluntary survey about local issues and public services. / स्थानीय समस्याओं और सार्वजनिक सेवाओं पर एक छोटा, स्वैच्छिक सर्वेक्षण।",
    status: "draft", version: 0, questions, rules, created_at: new Date().toISOString(), published: [],
  };
}
