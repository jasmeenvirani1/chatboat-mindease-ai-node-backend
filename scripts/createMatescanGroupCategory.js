/**
 * One-off script: creates the "Matescan Group" Category.
 * This gives the Matescan Group feature its own sidebar entry, separate from
 * the existing 1-on-1 Energy Match and CheckMate categories.
 *
 * Run: node scripts/createMatescanGroupCategory.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log("Connected to MongoDB");

  const Category = require("../models/CategoryModel");

  const existing = await Category.findOne({ name: "Matescan Group" });
  if (existing) {
    console.log(`Already exists: ${existing._id}. No changes made.`);
    await mongoose.disconnect();
    return;
  }

  const created = await Category.create({
    name: "Matescan Group",
    name_th: "Matescan กลุ่ม",
    name_es: "Matescan Grupo",
    description: "Team energy-match reading for a leader and their group members",
    description_th: "วิเคราะห์พลังงานทีมสำหรับผู้นำและสมาชิกกลุ่ม",
    description_es: "Lectura de compatibilidad energetica para un lider y su equipo",
    icon: "users",
    isActive: true,
  });

  console.log(`Created "Matescan Group" category: ${created._id}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
