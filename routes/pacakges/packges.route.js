import express from "express";
import { generatePackages } from "../../controllers/packges/packges.contoller.js";

const router = express.Router();


router.post("/generatePackges", generatePackages)



export default router;