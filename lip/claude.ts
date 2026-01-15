import Anthropic from '@anthropic-ai/sdk';
import { activities, countries, destinations, seasonal_prices, travel_styles } from "../data/index.js"
import { ApiError } from "../utils/apiError.js";

// Types
export interface QuizAnswers {
    interests: string[];
    personality: string;
    pace: string;
    budget_level: string;
    travel_with: string;
}

export interface DailyPlan {
    day: number;
    morning: string;
    afternoon: string;
    evening: string;
}

export interface EstimatedBudget {
    accommodation_per_day: number;
    activities_per_day: number;
    food_per_day: number;
    total_per_day: number;
    total_trip: number;
    currency: string;
}

export interface TravelRecommendation {
    destination: string;
    country_code: string;
    why_this_destination: string;
    trip_duration_days: number;
    daily_plan: DailyPlan[];
    estimated_budget: EstimatedBudget;
    travel_persona_match: string;
}

// Static Data Interfaces
interface Country {
    code: string;
    name: string;
    region: string;
    best_for: string[];
    travel_pace: string;
    visa_required: boolean;
}

interface Activity {
    id: string;
    type: string;
    energy: string;
    duration_hours: number;
    country?: string;
}

interface Destination {
    country: string;
    city: string;
    best_for: string[];
    recommended_days: number;
}

interface SeasonalPrices {
    [countryCode: string]: {
        low: number;
        mid: number;
        high: number;
    };
}

interface TravelStyles {
    [key: string]: {
        description: string;
        activity_ratio: number;
        relax_ratio: number;
    };
}


/**
 * SMART FILTERING: Reduce data before sending to Claude
 * This dramatically reduces token usage for large datasets
 */
function filterRelevantData(
    quizAnswers: QuizAnswers,
    countries: Country[],
    seasonal_prices: SeasonalPrices,
    activities: Activity[],
    destinations: Destination[],
) {

    console.log(countries, "countries before filtertion")
    // 1. Filter countries based on user interests
    const matchingCountries = countries.filter(country => {
        // Check if country's best_for matches any user interests
        const hasMatchingInterest = country.best_for.some(interest =>
            quizAnswers.interests.includes(interest)
        );

        // Match personality (relaxing → relax destinations)
        const matchesPersonality =
            (quizAnswers.personality === 'relaxing' && country.best_for.includes('relax')) ||
            (quizAnswers.personality === 'adventurous' && country.best_for.includes('explorer')) ||
            (quizAnswers.personality === 'cultural' && country.best_for.includes('culture'));

        return hasMatchingInterest || matchesPersonality;
    });

    // If no exact matches, take top 3-5 countries to give Claude options
    const relevantCountries = matchingCountries.length > 0
        ? matchingCountries.slice(0, 5)
        : countries.slice(0, 5);

    // 2. Get country codes for filtering
    const relevantCountryCodes = relevantCountries.map(c => c.code);

    // 3. Filter destinations to only relevant countries
    const relevantDestinations = destinations.filter(dest =>
        relevantCountryCodes.includes(dest.country)
    );

    // 4. Filter seasonal prices to only relevant countries
    const relevantPrices: SeasonalPrices = {};
    relevantCountryCodes.forEach(code => {
        if (seasonal_prices[code]) {
            relevantPrices[code] = seasonal_prices[code];
        }
    });

    // 5. Filter activities based on user interests and relevant countries
    const relevantActivities = activities.filter(activity => {
        // Match activity type with user interests
        const matchesInterest = quizAnswers.interests.some(interest =>
            activity.type.toLowerCase().includes(interest.toLowerCase()) ||
            interest.toLowerCase().includes(activity.type.toLowerCase())
        );

        // If activity has country, only include if country is relevant
        const matchesCountry = !activity.country || relevantCountryCodes.includes(activity.country);

        // Match energy level with pace
        const matchesPace =
            (quizAnswers.pace === 'balanced') ||
            (quizAnswers.pace === 'slow' && activity.energy === 'low') ||
            (quizAnswers.pace === 'fast' && activity.energy === 'high');

        return (matchesInterest || matchesPace) && matchesCountry;
    });

    // Take max 20 activities to prevent huge prompts
    const limitedActivities = relevantActivities.slice(0, 20);

    return {
        countries: relevantCountries,
        destinations: relevantDestinations,
        prices: relevantPrices,
        activities: limitedActivities,
    };
}


// Initialize Anthropic client
// const anthropic = new Anthropic({
//     apiKey: process.env.ANTHROPIC_API_KEY
// });

/**
 * Build optimized prompt with filtered data
 */
function buildPrompt(
    quizAnswers: QuizAnswers,
    filteredData: ReturnType<typeof filterRelevantData>,
    travelStyles: TravelStyles
): string {
    console.log(filteredData.countries, "countries from prompt builder after filtertion")
    return `You are an AI Travel Architect and behavioral travel expert.
You MUST only use the provided destinations and prices.
Do not invent cities, prices, or activities.

USER PROFILE (from quiz):
${JSON.stringify(quizAnswers, null, 2)}

AVAILABLE DATA (pre-filtered for this user):

Countries (${filteredData.countries.length} matches):
${JSON.stringify(filteredData.countries, null, 2)}

Seasonal Prices:
${JSON.stringify(filteredData.prices, null, 2)}

Travel Styles:
${JSON.stringify(travelStyles, null, 2)}

Activities (${filteredData.activities.length} relevant):
${JSON.stringify(filteredData.activities, null, 2)}

Destinations:
${JSON.stringify(filteredData.destinations, null, 2)}

INSTRUCTIONS:
1. Analyze the user's profile and match them to the BEST destination from the available countries
2. Select ONLY cities from the destinations array that match their country
3. Use ONLY activities from the provided activities list
4. Calculate budget using the seasonal_prices for the selected country
5. Create a realistic daily plan with activities from the activities list
6. Match the trip duration to the recommended_days from destinations
7. Consider their budget_level: "value" means use "low" or "mid" season prices, "luxury" means "high"
8. Consider their pace: "balanced" means mix of activities and rest
9. Consider their travel_with: "partner" means romantic, couple-friendly activities

You MUST respond with ONLY a valid JSON object (no markdown, no backticks, no explanations) matching this exact schema:

{
  "destination": "Country Name, City Name",
  "country_code": "XX",
  "why_this_destination": "2-3 sentence explanation of why this matches their profile",
  "trip_duration_days": 0,
  "daily_plan": [
    {
      "day": 1,
      "morning": "activity from activities list",
      "afternoon": "activity from activities list",
      "evening": "activity from activities list"
    }
  ],
  "estimated_budget": {
    "accommodation_per_day": 0,
    "activities_per_day": 0,
    "food_per_day": 0,
    "total_per_day": 0,
    "total_trip": 0,
    "currency": "USD"
  },
  "travel_persona_match": "Explorer/Relaxer/Luxury with explanation"
}`;
}


// Main function to generate recommendation
export async function generateRecommendation(
    quizAnswers: QuizAnswers
): Promise<TravelRecommendation> {
    try {

        const filteredData = filterRelevantData(
            quizAnswers,
            countries,
            seasonal_prices,
            activities,
            destinations,
        );

        // Build the prompt
        const prompt = buildPrompt(
            quizAnswers,
            filteredData,
            travel_styles,
        );

        // Call Claude API
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 4096,
            temperature: 0.7,
            system: `
                        You are an AI Travel Architect.
                        You MUST follow the schema exactly.
                        Return JSON only.
                        Do not add explanations.
                    `,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });

        // Extract and parse the response
        const responseText = message.content[0].text.trim();

        // Remove markdown code blocks if present
        let cleanedResponse = responseText;
        if (responseText.startsWith('```')) {
            cleanedResponse = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
        }

        // Parse the JSON response
        const recommendation: TravelRecommendation = JSON.parse(cleanedResponse);

        return recommendation;
    } catch (error) {
        console.error('Error generating recommendation:', error);

        // JSON parsing error (Claude returned invalid JSON)
        if (error instanceof SyntaxError) {
            throw new ApiError(
                502,
                `Failed to parse AI response (invalid JSON): ${error.message}`
            );
        }

        // Claude / Anthropic API error
        if (error instanceof Anthropic.APIError) {
            throw new ApiError(
                error.status || 502,
                `Claude API error: ${error.message}`
            );
        }

        // Known ApiError → rethrow as-is
        if (error instanceof ApiError) {
            throw error;
        }

        // Fallback (unknown error)
        throw new ApiError(
            500,
            'Failed to generate travel recommendation'
        );
    }
};

