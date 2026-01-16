import { seasonal_prices, destinations, activities } from "../data/index.js";
import { attachDestinationMeta } from "./destination.mapper.ts";

/* ================= TYPES ================= */

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
    currency: "USD";
}

export interface FinalPackage {
    destination: string;        // "Italy, Florence"
    country_code: string;       // "IT"

    // 🔥 destination meta (from static data)
    lat: number | null;
    lng: number | null;
    image: string | null;

    why_this_destination: string;
    trip_duration_days: number;

    daily_plan: DailyPlan[];
    estimated_budget: EstimatedBudget;

    travel_persona_match: string;
}


/* ================= HELPERS ================= */
function buildDestinationActivityPool(
    destination: any,
    allActivities: any[],
    lang: "en" | "ar"
): string[] {
    console.log("Building activity pool for:", destination?.city);
    console.log("Destination best_for:", destination?.best_for);
    console.log("Total activities available:", allActivities.length);

    const keys = destination?.best_for || [];

    const filtered = allActivities.filter(a => {
        if (!a || !a.type) return false;

        // Handle both string and array types
        const activityTypes = Array.isArray(a.type) ? a.type : [a.type];
        const match = activityTypes.some((t: string) => keys.includes(t));

        if (match) {
            console.log("Matched activity:", a.id, "with type:", a.type);
        }
        return match;
    });

    console.log("Filtered activities count:", filtered.length);

    const result = filtered.map(a =>
        lang === "ar" ? a.label_ar : a.label_en
    );

    console.log("Activity pool result:", result);
    return result;
}



export function buildDailyPlan(
    days: number,
    activities: string[]
) {
    const plan = [];
    const slots = ["morning", "afternoon", "evening"];

    // clone & shuffle once
    let pool = [...activities].sort(() => 0.5 - Math.random());

    let index = 0;

    for (let day = 1; day <= days; day++) {
        const dayPlan: any = { day };

        for (const slot of slots) {
            // لو خلصنا الأنشطة، نعيد shuffle بدون تكرار مباشر
            if (index >= pool.length) {
                pool = [...activities].sort(() => 0.5 - Math.random());
                index = 0;
            }

            dayPlan[slot] = pool[index];
            index++;
        }

        plan.push(dayPlan);
    }

    return plan;
}


function calculateBudget(
    countryCode: string,
    days: number,
    budgetLevel: string
) {
    const prices = seasonal_prices[countryCode];
    const base =
        budgetLevel === "luxury"
            ? prices.high
            : budgetLevel === "value"
                ? prices.low
                : prices.mid;

    const accommodation = base;
    const activities = Math.round(base * 0.25);
    const food = Math.round(base * 0.3);

    const totalDay = accommodation + activities + food;

    return {
        accommodation_per_day: accommodation,
        activities_per_day: activities,
        food_per_day: food,
        total_per_day: totalDay,
        total_trip: totalDay * days,
        currency: "USD",
    };
}

/* ================= BUILDER ================= */

export function buildFinalPackage(
    aiPkg: any,
    quiz: any,
    lang: "en" | "ar" = "ar"
): FinalPackage {

    const destinationMeta = destinations.find(
        d => d.city == aiPkg.city
    );


    const activityPool = destinationMeta
        ? buildDestinationActivityPool(destinationMeta, activities, lang)
        : aiPkg.activity_pool;


    return {
        destination: aiPkg.destination,
        country_code: aiPkg.country_code,

        // 🔥 NEW
        lat: destinationMeta?.lat || null,
        lng: destinationMeta?.lng || null,
        image: destinationMeta?.image || null,

        why_this_destination: aiPkg.why_this_destination,

        trip_duration_days: aiPkg.trip_duration_days,

        daily_plan: buildDailyPlan(
            aiPkg.trip_duration_days,
            activityPool
        ),

        estimated_budget: calculateBudget(
            aiPkg.country_code,
            aiPkg.trip_duration_days,
            quiz.budget_level
        ),
        persona_type: aiPkg.persona_type,
        travel_persona_match: aiPkg.travel_persona_match,
    };
}
