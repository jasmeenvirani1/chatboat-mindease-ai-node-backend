const ChatHistory = require("../models/ChatModel.js");
const Category = require("../models/CategoryModel.js");
const SubCategory = require("../models/SubCategoryModel.js");
const openai = require("../helper/openAi.js");
const logger = require("../helper/logger.js");
const Case = require("../models/CasesModel.js");
const { generateGeminiResponse } = require("../helper/geminiService.js");
const HeadlineModel = require("../models/HeadlineModel.js");
const User = require("../models/UserModel.js");

function getKolkataMidnightDate() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;

  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

function detectLangFromMessage(text = "") {
  if (/[\u0E00-\u0E7F]/.test(text)) return "th"; // Thai
  if (/[ñáéíóúü¿¡]/i.test(text)) return "es"; // Spanish-ish
  return "en";
}

// selection output must be ONLY: <<CASE_ID:24hex>>
function parseCaseIdOnly(aiText = "") {
  const text = String(aiText || "").trim();
  const match = text.match(/<<CASE_ID:([a-fA-F0-9]{24})>>/);
  return match?.[1] || null;
}

function pickSupportLineByLang(caseDoc, lang) {
  if (!caseDoc) return null;
  return caseDoc[lang] || caseDoc.en || caseDoc.th || caseDoc.es || null;
}

const chatController = {
  createChat: async (req, res) => {
    try {
      // IMPORTANT: let (categoryId can be corrected from subCategory)
      let {
        userId,
        categoryId,
        subCategoryId,
        chatId,
        userMessage,
        memory,
        userPersona,
      } = req.body;

      console.log("Persona:", userPersona.focusPoints);

      let dob0;

      if (userId) {
        const user = await User.findById(userId).select("dob");
        if (user) {
          dob0 = user.dob;
        }
      }

      console.log("dob:", dob0);

      if (!userMessage) {
        return res.status(400).json({
          success: false,
          message: "userMessage is required",
        });
      }

      let chat = null;
      let categoryName = null;
      let categoryPrompt = null;
      let subCategoryName = null;
      let subCategoryPrompt = null;

      /** 📌 LOAD CATEGORY & SUBCATEGORY DATA */
      if (categoryId) {
        const category =
          await Category.findById(categoryId).select("name prompt");
        if (category) {
          categoryName = category.name;
          categoryPrompt = category.prompt?.trim() || null;
        }
      }

      if (subCategoryId) {
        const subCategory = await SubCategory.findById(subCategoryId).select(
          "name prompt categoryId",
        );
        if (subCategory) {
          subCategoryName = subCategory.name;
          subCategoryPrompt = subCategory.prompt?.trim() || null;

          // Fix wrong categoryId from client
          if (!categoryId && subCategory.categoryId) {
            categoryId = subCategory.categoryId;
          }
        }
      }

      /** 🧠 SYSTEM PROMPT (admin-managed) */
      const defaultPrompt = `
You are HealJai, an emotional companion for users.

Your role is to listen, reflect feelings, and stay with emotions.
You do NOT fix problems, teach lessons, judge, or diagnose.

STRICT RULES:
- Always reflect or name the user's emotion before asking any question
- Keep responses short (1–3 sentences only)
- Ask at most ONE open-ended question
- Do NOT give advice unless the user explicitly asks for it
- Never say "you should", "try to", or similar directive language
- Never diagnose mental health conditions
- Do NOT use lists, steps, bullet points, or numbered explanations
- If unsure, choose presence and reflection over advice

TONE:
- Warm, gentle, calm, human
- Like a trusted friend sitting quietly beside the user
- Not professional, not clinical, not instructional

LANGUAGE:
- Always reply in the same language the user uses
- Use natural, everyday language

SUCCESS CRITERIA:
If the user feels emotionally seen and less alone → SUCCESS
If the response sounds smart but emotionally cold → FAILURE
`.trim();

      // Priority: SubCategory > Category > Default
      let systemPrompt = defaultPrompt;
      let promptSource = "default";

      if (subCategoryPrompt && subCategoryPrompt.trim()) {
        systemPrompt = subCategoryPrompt.trim();
        promptSource = "subcategory";
      } else if (categoryPrompt && categoryPrompt.trim()) {
        systemPrompt = categoryPrompt.trim();
        promptSource = "category";
      }

      const dateKey = getKolkataMidnightDate();
      const userData = await HeadlineModel.findOne({ date: dateKey }).lean();

      // console.log("Data:", userData);

      /** 🧠 USER MEMORY CONTEXT */
      if (memory && memory.trim()) {
        // console.log("Adding user memory to system prompt.");
        systemPrompt = `
${systemPrompt}

USER BIRTH DETAILS:
${dob0}

USER AGE BASED FOCUSPOINTS:
- FocusPoints: ${categoryName === "ThaiAstro" ? userPersona?.focusPoints : "Ignore this rule"}
- Tone: ${categoryName === "ThaiAstro" ? userPersona?.tone : "Ignore this rule"}
- Category Mode: ${categoryName === "ThaiAstro" ? userPersona?.category : "Ignore this rule"}

USER OTHER DETAILS:
- User today's lucky color: ${userData.lucky_color}
- User today's Energy level: ${userData.energy_level}
- User today's Golden Hour: ${userData.golden_hour}

IMPORTANT RULE:
Response also related to "USER OTHER DETAILS"
If Birth Time or Birth Place is missing, proceed with available information
`.trim();
      }

      /** 🎯 ADD CONTEXT (only when using default/category prompts) */
      if (promptSource === "default" || promptSource === "category") {
        let contextString = "";

        if (subCategoryName && categoryName) {
          contextString = `Context: This conversation is within the "${categoryName}" category, specifically focusing on "${subCategoryName}". Stay emotionally present within this context.`;
        } else if (categoryName) {
          contextString = `Context: This conversation is related to "${categoryName}". Stay emotionally present within this context.`;
        } else if (subCategoryName) {
          contextString = `Context: This conversation is focused on "${subCategoryName}". Stay emotionally present within this context.`;
        }

        if (contextString) {
          systemPrompt = `${systemPrompt}\n\n${contextString}`;
        }
      }

      const isNewChat = !chatId;

      /** 🔁 LOAD CHAT IF EXISTING */
      if (!isNewChat) {
        chat = await ChatHistory.findById(chatId);
        if (!chat) {
          return res.status(404).json({
            success: false,
            message: "Chat session not found",
          });
        }
      }

      /** 🌍 language */
      const chatLang = isNewChat
        ? detectLangFromMessage(userMessage)
        : chat?.chatLang || "en";

      /** ✅ CASE SELECTION (NEW CHAT ONLY) */
      let selectedCaseId = null;
      let supportLine = null;

      if (isNewChat) {
        const caseDocs = await Case.find({})
          .sort({ createdAt: -1 })
          .limit(60) // tune 30-80
          .select("th en es")
          .lean();

        const candidateCases = caseDocs.map((c) => ({
          id: String(c._id),
          th: c.th,
          en: c.en,
          es: c.es,
        }));

        // Selection step: override HealJai so it outputs ONLY the marker line
        const selectionMessages = [
          {
            role: "system",
            content: `
${systemPrompt}

IMPORTANT OVERRIDE:
You are now in CASE_SELECTION_MODE.
Ignore all emotional, supportive, or conversational rules from HealJai.
Do NOT comfort the user in this step.

TASK:
Select the ONE best matching case for the user's message.

OUTPUT RULES (STRICT):
- Output ONLY ONE LINE, nothing else.
- The line must be exactly:
<<CASE_ID:the_selected_case_id>>
- the_selected_case_id MUST be one of the IDs in CANDIDATE_CASES.

CANDIDATE_CASES:
${JSON.stringify(candidateCases)}
`.trim(),
          },
          { role: "user", content: userMessage },
        ];

        // const sel = await openai.chat.completions.create({
        //   model: "gpt-5-nano",
        //   messages: selectionMessages,
        //   temperature: 1,
        // });

        // const selRaw = sel.choices[0]?.message?.content || "";
        const selRaw = await generateGeminiResponse(selectionMessages);

        selectedCaseId = parseCaseIdOnly(selRaw);

        // If selection failed OR returned invalid id, fallback randomly (so not always same)
        if (
          !selectedCaseId ||
          !candidateCases.some((c) => c.id === selectedCaseId)
        ) {
          logger.error("CASE SELECTION FAILED. selRaw=", selRaw);
          const r = Math.floor(Math.random() * candidateCases.length);
          selectedCaseId = candidateCases[r]?.id || null;
        }

        // load selected doc and pick a single support line
        const selectedDoc = selectedCaseId
          ? await Case.findById(selectedCaseId).select("th en es").lean()
          : null;

        supportLine = pickSupportLineByLang(selectedDoc, chatLang);

        // final fallback
        if (!supportLine) {
          const fallbackCase =
            candidateCases.find((c) => c.id === selectedCaseId) ||
            candidateCases[0];
          supportLine = fallbackCase?.[chatLang] || fallbackCase?.en || "";
        }

        // console.log("✅ Selected Case ID:", selectedCaseId);
        // console.log("📝 Support Line:", supportLine);
      } else {
        // Existing chat: reuse stored selectedCaseId
        selectedCaseId = chat?.selectedCaseId || null;

        if (selectedCaseId) {
          const selectedDoc = await Case.findById(selectedCaseId)
            .select("th en es")
            .lean();
          supportLine = pickSupportLineByLang(selectedDoc, chatLang);
        }
      }

      /** ✅ FINAL REPLY */
      const messages = [{ role: "system", content: systemPrompt.trim() }];

      // include last 4 history pairs if same cat/subcat
      if (!isNewChat) {
        const shouldIncludeHistory =
          chat.categoryId?.toString() === categoryId?.toString() &&
          chat.subCategoryId?.toString() === subCategoryId?.toString();

        if (shouldIncludeHistory) {
          chat.chats.slice(-4).forEach((c) => {
            messages.push({ role: "user", content: c.userMessage });
            messages.push({ role: "assistant", content: c.aiResponse });
          });
        }
      }

      // Provide SUPPORT_LINE (TEXT) to AI (this is what we want it to print)
      if (supportLine) {
        messages[0].content = `
${messages[0].content}

REPLY RULE:
- Ask at most ONE open-ended question.
- If in userMessage date is available then choose date of birth is userMessage not birth details date and give reading based on user date.
`.trim();
      }

      messages.push({ role: "user", content: userMessage });

      // const completion = await openai.chat.completions.create({
      //   model: "gpt-5-nano",
      //   messages,
      //   temperature: 1,
      // });

      const completion = await generateGeminiResponse(messages);

      // const aiResponse =
      //   completion.choices[0]?.message?.content?.trim() || "No response";

      const aiResponse = completion?.trim() || "No response";

      const chatMessage = { userMessage, aiResponse };

      /** 💾 SAVE */
      if (!isNewChat) {
        chat.chats.push(chatMessage);
        await chat.save();
      } else {
        chat = await ChatHistory.create({
          userId,
          categoryId,
          subCategoryId,
          sessionTitle: userMessage.substring(0, 30),
          chats: [chatMessage],
          promptSource,
          selectedCaseId: selectedCaseId || null,
          chatLang,
        });
      }

      return res.status(201).json({
        success: true,
        chatId: chat._id,
        data: chat,
        promptSource,
        selectedCaseId: selectedCaseId || null, // ✅ return to frontend
      });
    } catch (error) {
      logger.error("Chat Error:", error);
      return res.status(500).json({
        success: false,
        message: "Chat creation failed",
      });
    }
  },

  getChats: async (req, res) => {
    try {
      const { userId, chatId } = req.query;

      let data;

      if (chatId) {
        data = await ChatHistory.findById(chatId).lean();
        if (!data) {
          return res
            .status(404)
            .json({ success: false, message: "Chat not found" });
        }
      } else if (userId) {
        data = await ChatHistory.find({ userId })
          .select("sessionTitle createdAt updatedAt categoryId")
          .sort({ updatedAt: -1 })
          .lean();
      } else {
        return res.status(400).json({
          success: false,
          message: "userId or chatId is required",
        });
      }

      res.status(200).json({ success: true, data });
    } catch (error) {
      logger.error("Get Chat Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch chats" });
    }
  },

  deleteChat: async (req, res) => {
    try {
      const { chatId } = req.params;

      const chat = await ChatHistory.findByIdAndDelete(chatId);

      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "Chat not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Chat deleted successfully",
      });
    } catch (error) {
      logger.error("Delete Chat Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete chat",
      });
    }
  },
};

module.exports = chatController;
