import { GoogleGenAI } from "@google/genai";
import Setting from "../models/SettingModel.js";

export const generateGeminiResponse = async (messages) => {
  try {
    const settings = await Setting.find();
    const gemini_api_key = settings[0]?.gemini_api_key || "";

    if (!gemini_api_key) {
      throw new Error("Gemini API key not found in database");
    }

    const genAI = new GoogleGenAI({
      apiKey: gemini_api_key,
    });

    const prompt = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini error:", error);
    throw error;
  }
};
