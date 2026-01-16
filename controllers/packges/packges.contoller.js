import { generateAIDecisions } from "../../lip/claude.ts";
import { buildFinalPackage } from "../../lip/package.builder.ts";

export const generatePackages = async (req, res, next) => {
    try {
        const { quizAnswers } = req.body;

        // default Arabic
        const aiResult = await generateAIDecisions(quizAnswers, "ar");

        // console.log(aiResult.packages,"here")

        const finalPackages = aiResult.packages.map(pkg =>
            buildFinalPackage(pkg, quizAnswers)
        );

        res.json({
            success: true,
            packages: finalPackages,
            generated_at: new Date().toISOString(),
            lang: "ar",
        });
    } catch (err) {
        next(err);
    }
};
