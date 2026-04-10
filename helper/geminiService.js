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
      model: "gemini-2.5-flash-lite",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini error:", error);
    if (error?.message && !error.message.startsWith("Gemini error:")) {
      throw new Error(`Gemini error: ${error.message}`);
    }
    throw error;
  }
};

export const generateGeminiResponseStream = async (messages) => {
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

    const stream = await genAI.models.generateContentStream({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
    });

    return stream;
  } catch (error) {
    console.error("Gemini stream error:", error);
    if (error?.message && !error.message.startsWith("Gemini stream error:")) {
      throw new Error(`Gemini stream error: ${error.message}`);
    }
    throw error;
  }
};
