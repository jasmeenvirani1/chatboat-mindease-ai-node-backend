/**
 * One-off script: creates the shared "Energy Match V3 Astria" Category.
 * All Astria region tabs point their Energy Match V3 tab at this single
 * Category id, so they all share one prompt (vs. Healjai's own "Energy
 * Match" category/prompt, which is reused unchanged).
 *
 * Run: node scripts/createEnergyMatchV3AstriaCategory.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const ENERGY_MATCH_V3_ASTRIA_PROMPT = `
OUTPUT SAMPLE:
{
  "theme": "Astria Energy Match - White Theme Flow",
  "pages": [
    {
      "pageId": "P2_Prediction",
      "title": "Your Energy Compatibility",
      "components": {
        "scoreGauge": { "value": 78, "label": "Alignment Score" },
        "lifeGraph": {
          "type": "Radar/Spider",
          "categories": ["Emotional Flow", "Mental Rhythm", "Action Drive", "Harmony Field", "Communication Energy"],
          "value": [rate each category above as a number out of 100]
        },
        "summary": [
          { "type": "positive", "title": "Areas of Good Compatibility", "text": "Shared dreams and life rhythms create a strong foundation." },
          { "type": "adjustment", "title": "Areas for Tuning", "text": "Differences in action drive and timing may require adjustment." }
        ]
      }
    },
    {
      "pageId": "P3_Insights",
      "title": "Energy Insights",
      "cards": [
        { "id": "energy_flow", "title": "Energy Flow", "description": "Prediction description (about 50 words)", "icon": "wave" },
        { "id": "emotional", "title": "Emotional Connection", "description": "Prediction description (about 50 words)", "icon": "heart" },
        { "id": "action", "title": "Action & Timing", "description": "Prediction description (about 50 words)", "icon": "clock" },
        { "id": "communication", "title": "Communication Tips", "description": "Prediction description (about 50 words)", "icon": "chat" }
      ]
    },
    {
      "pageId": "P4_ChatWithHealjai",
      "chatHistory": [
        { "sender": "Astria", "text": "Hello! What would you like me to look into for you?" }
      ],
      "quickReplies": ["Give me more guidance", "Show my energy summary again"]
    }
  ]
}

RESTRICTED RULE:
- Answer based on the birth details of me and my partner provided in the INPUT.
- The result must always be in the JSON format shown in the output sample.
- All information must be based on real planetary positions.
- The answer must always follow the structure of the sample provided.
- If any information is missing, skip that part and continue responding.
- The results in the answer must always be factual, based on planetary positions.
`.trim();

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log("Connected to MongoDB");

  const Category = require("../models/CategoryModel");

  const existing = await Category.findOne({ name: "Energy Match V3 Astria" });
  if (existing) {
    console.log(`Already exists: ${existing._id}. No changes made.`);
    await mongoose.disconnect();
    return;
  }

  const created = await Category.create({
    name: "Energy Match V3 Astria",
    name_th: "Energy Match V3 Astria",
    name_es: "Energy Match V3 Astria",
    description: "Shared Energy Match V3 prompt for all Astria categories",
    prompt: ENERGY_MATCH_V3_ASTRIA_PROMPT,
    freeUserPrompt: ENERGY_MATCH_V3_ASTRIA_PROMPT,
    icon: "handshake",
    isActive: true,
  });

  console.log(`Created "Energy Match V3 Astria" category: ${created._id}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
