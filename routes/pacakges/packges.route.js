import express from "express";
import { generatePackges } from "../../controllers/packges/packges.contoller.js";

const router = express.Router();


router.post("/generatePackges", generatePackges)



export default router;