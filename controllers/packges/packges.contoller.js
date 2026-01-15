import { ApiError } from "../../utils/apiError.js";
import { generateRecommendation } from "../../lip/claude.ts";
import { activities, countries, destinations, seasonal_prices, travel_styles } from "../../data/index.js"

export const generatePackges = async (req, res, next) => {
    try {
        const { quizAnswers } = req.body;

        // Validate quiz answers
        if (
            !quizAnswers ||
            !quizAnswers.interests ||
            !quizAnswers.personality ||
            !quizAnswers.pace ||
            !quizAnswers.budget_level ||
            !quizAnswers.travel_with
        ) {
            return next(
                new ApiError(400, 'Invalid quiz answers. All fields are required.')
            );
        }

        // Generate recommendation using Claude
        const recommendation = await generateRecommendation(
            quizAnswers
        );

        res.status(200).json({
            success: true,
            recommendation,
            quiz_profile: quizAnswers,
            generated_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error('generatePackges Error:', error.message);
        return next(new ApiError(500, 'Internal Server Error'));
    }
}