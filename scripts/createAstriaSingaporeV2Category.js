/**
 * One-off script: creates the "Astria Singapore V2" Category (Compatibility
 * Engine v2) and its "Compatibility" SubCategory, seeded with the default
 * prompt from helper/astriaSingaporeV2Service.js.
 *
 * Separate from "Astria Singapore" (the existing PSM lane) — v1 is untouched,
 * same pattern used for every prior version bump (Astria Korea V2/V3, Astria
 * GCC V2). Idempotent: safe to re-run, skips anything that already exists.
 *
 * Run: node scripts/createAstriaSingaporeV2Category.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const CATEGORY_NAME = "Astria Singapore V2";
const SUBCATEGORY_NAME = "Compatibility";

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log("Connected to MongoDB");

  const Category = require("../models/CategoryModel");
  const SubCategory = require("../models/SubCategoryModel");
  const { DEFAULT_SGV2_SUBCATEGORY_PROMPTS } = require("../helper/astriaSingaporeV2Service");

  let category = await Category.findOne({ name: CATEGORY_NAME });
  if (!category) {
    // CategoryModel requires name_th/name_es/name_ja/name_ko/name_id —
    // Singapore V2 is English/Singlish-first, so these fall back to the
    // English name rather than being left unset (which would fail
    // Mongoose's required-field validation on create).
    category = await Category.create({
      name: CATEGORY_NAME,
      name_th: CATEGORY_NAME,
      name_es: CATEGORY_NAME,
      name_ja: CATEGORY_NAME,
      name_ko: CATEGORY_NAME,
      name_id: CATEGORY_NAME,
      name_vi: CATEGORY_NAME,
      description: "Compatibility Engine v2 — practical, direct, Singapore-specific compatibility readings.",
      icon: "handshake",
      isActive: true,
    });
    console.log(`Created category "${CATEGORY_NAME}": ${category._id}`);
  } else {
    console.log(`Category "${CATEGORY_NAME}" already exists: ${category._id}`);
  }

  const existingSubCategory = await SubCategory.findOne({
    categoryId: category._id,
    name: SUBCATEGORY_NAME,
  });

  if (!existingSubCategory) {
    const compatibilityPrompt = DEFAULT_SGV2_SUBCATEGORY_PROMPTS.compatibility;
    const subCategory = await SubCategory.create({
      categoryId: category._id,
      name: SUBCATEGORY_NAME,
      name_th: SUBCATEGORY_NAME,
      name_es: SUBCATEGORY_NAME,
      name_ja: SUBCATEGORY_NAME,
      name_ko: SUBCATEGORY_NAME,
      name_id: SUBCATEGORY_NAME,
      name_vi: SUBCATEGORY_NAME,
      description: "Weighted compatibility score, strengths, friction points, action steps, and Singapore context.",
      prompt: compatibilityPrompt,
      freeUserPrompt: compatibilityPrompt,
      icon: "heart",
      isActive: true,
    });
    console.log(`Created subcategory "${SUBCATEGORY_NAME}": ${subCategory._id}`);
  } else {
    console.log(`Subcategory "${SUBCATEGORY_NAME}" already exists: ${existingSubCategory._id}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
