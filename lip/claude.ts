import Anthropic from "@anthropic-ai/sdk";
import { countries, destinations, activities } from "../data/index.js";
import { ApiError } from "../utils/apiError.js";

/* ================= TYPES ================= */

export interface QuizAnswers {
  interests: string[];
  personality: string;
  pace: string;
  budget_level: "value" | "mid" | "luxury";
  travel_with: string;
  days_range: "3-5" | "5-10" | "10-15";
}

export interface AIPackageDecision {
  destination: string;
  country_code: string;
  trip_duration_days: number;
  activity_pool: string[];
  persona_type: string;
}

export interface MultiAIDecisionResponse {
  packages: AIPackageDecision[];
}

/* ================= CLIENT ================= */

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/* ================= HELPERS ================= */

function parseDaysRange(range: string) {
  const [min, max] = range.split("-").map(Number);
  return { min, max };
}

/* ================= FILTER DATA ================= */
function filterRelevantData(quiz: QuizAnswers, lang: "en" | "ar") {
  const matchingCountries = countries
    .filter(c => c.best_for.some(i => quiz.interests.includes(i)))
    .slice(0, 6)
    .map(c => ({
      code: c.code,
      name: lang === "ar" ? c.name_ar : c.name,
      best_for: lang === "ar" ? c.best_for_ar : c.best_for,
    }));

  const countryCodes = matchingCountries.map(c => c.code);

  const relevantDestinations = destinations
    .filter(d => countryCodes.includes(d.country))
    .map(d => ({
      country: d.country,
      city_ar: lang === "ar" ? d.city_ar : d.city,
      city: d.city,
      lat: d.lat,
      lng: d.lng,
      image: d.image,
    }));

  const relevantActivities = activities
    .filter(a => quiz.interests.some(i => a.type.includes(i)))
    .slice(0, 10)
    .map(a => ({
      id: a.id,
      label: lang === "ar" ? a.label_ar : a.label_en,
    }));

  return {
    countries: matchingCountries,
    destinations: relevantDestinations,
    activities: relevantActivities,
  };
}


/* ================= PROMPT ================= */

function buildPrompt(
  quiz: QuizAnswers,
  filteredData: ReturnType<typeof filterRelevantData>
): string {
  const { min, max } = parseDaysRange(quiz.days_range);

  return `
Generate exactly 4 travel package decisions.

IMPORTANT: Respond in Arabic. All text fields (why_this_destination,   travel_persona_match) must be in Arabic

USER:
${JSON.stringify(quiz)}

DATA:
${JSON.stringify(filteredData)}

RULES:
- Each package must use a DIFFERENT destination
- trip_duration_days MUST be between ${min} and ${max}
- Choose 4–6 activity IDs only
- NO daily plans
- Daily plans: vary activities (no repeats in same time slots)
- NO prices
- NO explanations

DAILY PLAN CONSTRAINTS (VERY IMPORTANT):
- Each day MUST be different from the others
- Do NOT repeat the same activity sequence across days
- Do NOT place the same activity in the same time slot on consecutive days
- If activities are limited, rotate them intelligently
- Prefer variety over repetition

PACKAGE TYPES (use each once):
1. Best Match
2. Budget
3. Luxury
4. Alternative Country
5. Extended Stay

FORMAT (JSON ONLY):
{
  "packages": [
    {
      "destination": "Country, City",
      "country_code": "XX",
      "city": "city (not city_ar)"
      "why_this_destination": "1-2 sentences",
      "trip_duration_days": 0,
      "activity_pool": ["id","id"],
      "persona_type": "Best Match",
      "travel_persona_match": "Type + reason"
    }
  ]
}`;
}

/* ================= MAIN ================= */

export async function generateAIDecisions(
  quiz: QuizAnswers,
  lang: "en" | "ar" = "ar"
): Promise<MultiAIDecisionResponse> {
  try {
    const filteredData = filterRelevantData(quiz, lang);
    const prompt = buildPrompt(quiz, filteredData);

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1500,
      temperature: 0.6,
      system: "Return valid JSON only.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].text
      .replace(/```json|```/g, "")
      .trim();

    return JSON.parse(text);
  } catch (err) {
    console.error(err);
    throw new ApiError(502, "Claude decision generation failed");
  }
}