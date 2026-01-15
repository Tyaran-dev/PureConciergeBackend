import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import { ApiError } from "./utils/apiError.js";
import packagesRoute from "./routes/pacakges/packges.route.js"

const app = express();
dotenv.config();
const allowedOrigins = [
    'http://localhost:4025',  // development
    'https://tayyran.com'     // production
];


app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin like mobile apps or curl
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,  // <-- allow cookies
}));
const PORT = process.env.PORT || 3000;


// app.use(cookieParser());

app.use(express.json());

app.use("/pacakes", packagesRoute);

app.use((err, req, res, next) => {
    console.error("🔥 ERROR:", err);

    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    }

    // Unexpected error (not ApiError)
    return res.status(500).json({
        status: "error",
        message: "Something went wrong on the server",
    });
});



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});