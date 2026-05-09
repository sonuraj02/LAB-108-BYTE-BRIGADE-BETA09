import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export async function getRecommendations(userMajor: string, userInterests: string[], listings: any[]) {
  try {
    const prompt = `
      As a smart marketplace assistant for college students, recommend products to a student.
      Student Info:
      - Major: ${userMajor}
      - Interests: ${userInterests.join(", ")}

      Available Listings (titles and categories):
      ${listings.map(l => `- ${l.title} (Category: ${l.category}, ID: ${l.id})`).join("\n")}

      Return a list of listing IDs that would be most relevant to this student.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            reasoning: { type: Type.STRING }
          },
          required: ["recommendedIds"]
        }
      }
    });

    const result = JSON.parse(response.text);
    return result.recommendedIds;
  } catch (error) {
    console.error("Gemini Recommendation Error:", error);
    return [];
  }
}
