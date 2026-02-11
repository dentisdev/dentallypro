import { GoogleGenAI, Type } from "@google/genai";
import { ImageAnalysisResult, ClinicalData } from "../types";

// Helper to safely get the API key from process.env
const getApiKey = (): string | undefined => {
    return process.env.API_KEY;
};

// Helper to determine if we should retry based on the error
const isRetryableError = (error: any, retryOnQuota: boolean): boolean => {
  const msg = (
    error?.message || 
    error?.error?.message || 
    (typeof error === 'string' ? error : JSON.stringify(error))
  ).toLowerCase();
  
  const status = error?.status || error?.code || error?.error?.code;

  // STRICT CHECK: 429 Errors (Quota Exceeded / Too Many Requests)
  if (status === 429 || msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted")) {
    return retryOnQuota;
  }
  
  // Network / Server errors
  if (
      msg.includes("error code: 6") || 
      msg.includes("failed to fetch") || 
      msg.includes("networkerror") || 
      status === 503 || 
      status === 504
  ) {
    return true;
  }

  return false;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper for trying multiple models
async function withModelFallback<T>(
    operation: (model: string, apiKey: string) => Promise<T>, 
    models: string[] = ['gemini-2.5-flash', 'gemini-3-flash-preview']
): Promise<T> {
    const apiKey = getApiKey();
    
    if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
        console.error("API Key Check Failed.");
        throw new Error("مفتاح API مفقود! تأكد من إعدادات البيئة (Environment Variables).");
    }

    let lastError;
    for (const model of models) {
        try {
            return await operation(model, apiKey);
        } catch (error: any) {
            lastError = error;
            console.warn(`Model ${model} failed:`, error.message);
            
            // If it's a 429 error, wait significantly before trying the next model
            const isQuota = error?.message?.includes("429") || error?.message?.toLowerCase().includes("quota");
            
            if (models.indexOf(model) < models.length - 1) {
                if (isQuota) {
                    console.log(`⚠️ Quota hit on ${model}. Waiting 8 seconds before fallback...`);
                    await delay(8000); 
                } else {
                    await delay(1000);
                }
                console.log(`Falling back to ${models[models.indexOf(model) + 1]}...`);
                continue;
            }
        }
    }
    throw lastError;
}

// EXPONENTIAL BACKOFF RETRY LOGIC
async function withRetry<T>(
    fn: (attempt: number) => Promise<T>, 
    retries = 3, 
    retryOnQuota = true
): Promise<T> {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn(i);
    } catch (error: any) {
      lastError = error;
      
      if (!isRetryableError(error, retryOnQuota)) {
        throw error;
      }

      // Check if it's specifically a Quota error
      const msg = (error?.message || "").toLowerCase();
      const isQuota = msg.includes("quota") || msg.includes("429") || msg.includes("resource_exhausted") || error?.status === 429;

      console.warn(`Attempt ${i + 1} failed. Quota Error: ${isQuota}. Retrying...`);
      
      if (i < retries - 1) {
        // Exponential Backoff Strategy
        // If Quota: 8s, 16s, 32s (Give the API time to recover)
        // If Network: 2s, 4s, 8s
        const baseDelay = isQuota ? 8000 : 2000;
        const waitTime = baseDelay * Math.pow(2, i) + (Math.random() * 1000);
        
        console.log(`⏳ Waiting ${Math.floor(waitTime / 1000)}s before retry...`);
        await delay(waitTime); 
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const parseAIResponse = (text: string | undefined): any => {
    if (!text) throw new Error("استجابة فارغة من المحرك.");
    let cleanText = text.replace(/```json\n?|```/g, '').trim();
    const firstBracket = cleanText.indexOf('{');
    const lastBracket = cleanText.lastIndexOf('}');
    if (firstBracket !== -1 && lastBracket !== -1) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1);
    }
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse JSON", cleanText);
        throw new Error("فشل في قراءة بيانات JSON من الاستجابة.");
    }
};

// 1. Simulation Content
export const generateSimulationContent = async (topic: string) => {
  return await withModelFallback(async (modelName, apiKey) => {
    return await withRetry(async (attempt) => {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      const schemaDescription = `
      OUTPUT: JSON Object.
      LANGUAGE: ARABIC (Scientific Medical Arabic).
      Structure: {
        "theorySummary": "string", "riskLevel": "string",
        "hotspots": [{ "x": number, "y": number, "label": "string", "description": "string", "diagnosis": "string", "indications": "string", "classification": "string", "treatmentPlan": "string", "clinicalPearl": "string", "commonMistake": "string" }],
        "vitals": { "heartRate": number, "bloodPressure": "string", "oxygenSaturation": number },
        "imagePrompt": "string (English, Photorealistic clinical view)",
        "radiologyPrompt": "string (English, X-Ray)",
        "explodedPrompt": "string (English, 3D Diagram)"
      }`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: `Topic: "${topic}". Create a dental clinical simulation scenario.\n\n${schemaDescription}` }] }],
        config: { 
          systemInstruction: "You are a Clinical Dental Simulation Architect. Return valid JSON.",
          responseMimeType: "application/json"
        }
      });

      return { data: parseAIResponse(response.text) };
    }, 3, true); 
  });
};

// 2. Practical Protocol
export const generatePracticalContent = async (topic: string) => {
  return await withModelFallback(async (modelName, apiKey) => {
    return await withRetry(async (attempt) => {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      const schemaDescription = `
      OUTPUT: JSON Object.
      Structure: {
        "practicalProtocol": [{
            "id": "string", 
            "title": "string (Section Title)", 
            "originalText": "string (SECTION 1: The EXACT original English source text for this segment. Keep it raw and academic.)",
            "medicalTranslation": "string (SECTION 2: Precise Medical Arabic Translation of the original text.)",
            "professorComment": "string (SECTION 3: The Deep Explanation. Arabic. Medium length. Insightful, linking concepts together, beautiful language, but not overly long.)",
            "memoryAid": "string (SECTION 4: The Funny Mnemonic. EXTREMELY FUNNY & CREATIVE. Use characters, scenarios, wordplay, puns, or local humor to help memorize the concept. E.g., 'Pharma -> A mouse (Far) didn't eat so he needed meds'. Make it memorable!)",
            "visualPrompt": "string (SECTION 5: English. A description for a specific clinical image representing this exact step.)"
        }]
      }`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: `Topic/Text to Explain: "${topic}". \n\n${schemaDescription}` }] }],
        config: { 
          systemInstruction: "You are the 'Legendary Dental Mentor'. Output strictly valid JSON.",
          responseMimeType: "application/json"
        }
      });

      return { data: parseAIResponse(response.text) };
    }, 3, true);
  });
};

// 3. Quiz Generation
export const generateQuizContent = async (
    topic: string, 
    language: 'ar' | 'en' = 'ar', 
    count: number = 5,
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Intellectual' = 'Medium'
) => {
  return await withModelFallback(async (modelName, apiKey) => {
    return await withRetry(async (attempt) => {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      const langInstruction = language === 'ar' ? "ARABIC" : "ENGLISH";
      const schemaDescription = `
      OUTPUT: JSON Object.
      LANGUAGE: ${langInstruction}.
      Structure: {
        "essayQuestions": [{ "id": "string", "question": "string", "answer": "string", "difficulty": "${difficulty}", "keyPoints": ["string"] }],
        "shortAnswerQuestions": [{ "id": "string", "question": "string", "answer": "string", "difficulty": "${difficulty}" }],
        "mcqQuestions": [{ "id": "string", "question": "string", "options": ["string"], "correctAnswer": "string", "explanation": "string", "difficulty": "${difficulty}" }]
      }`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: `Topic: "${topic}". Create an exam with ${count} questions. Level: ${difficulty}\n\n${schemaDescription}` }] }],
        config: { 
          systemInstruction: `You are a Dental School Professor. Create exam. JSON only.`,
          responseMimeType: "application/json"
        }
      });

      return { data: parseAIResponse(response.text) };
    }, 3, true);
  });
};

// 4. Research Content
export const generateResearchContent = async (topic: string) => {
  return await withModelFallback(async (modelName, apiKey) => {
    return await withRetry(async (attempt) => {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      const schemaDescription = `
      OUTPUT: JSON Object.
      Structure: {
        "imagePrompts": ["string", "string", "string"],
        "searchQueries": ["string"]
      }`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: `Topic: "${topic}". Create 3 distinct medical image prompts and use Google Search.\n\n${schemaDescription}` }] }],
        config: { 
          tools: [{ googleSearch: {} }],
        }
      });

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      let prompts: string[] = [];
      try {
          const json = parseAIResponse(response.text);
          if (json.imagePrompts && Array.isArray(json.imagePrompts)) prompts = json.imagePrompts;
      } catch (e) {
          prompts = [`Dental clinical view of ${topic}`, `Anatomical diagram of ${topic}`, `X-ray of ${topic}`];
      }
      while (prompts.length < 3) prompts.push(`Dental clinical view of ${topic}`);
      return { sources: sources, prompts: prompts.slice(0, 3) };
    }, 3, true);
  });
};

// Image Analysis
export const analyzeDentalImage = async (base64Image: string): Promise<ImageAnalysisResult> => {
  return await withModelFallback(async (modelName, apiKey) => {
    return await withRetry(async (attempt) => {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const base64Data = base64Image.split(',')[1] || base64Image;

      const response = await ai.models.generateContent({
        model: modelName, 
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/png', data: base64Data } },
            { text: `Perform high-precision dental analysis. Return strict JSON.` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isHighQuality: { type: Type.BOOLEAN },
              rejectionReason: { type: Type.STRING },
              detailedClinicalAnalysis: { type: Type.STRING },
              landmarks: { type: Type.ARRAY, items: { type: Type.STRING } },
              dangerZones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    riskLevel: { type: Type.STRING, enum: ["HIGH", "MODERATE", "LOW"] },
                    description: { type: Type.STRING },
                    box: { type: Type.OBJECT, properties: { ymin: { type: Type.NUMBER }, xmin: { type: Type.NUMBER }, ymax: { type: Type.NUMBER }, xmax: { type: Type.NUMBER } } }
                  }
                }
              },
              adaCompliance: {
                type: Type.OBJECT,
                properties: { compliant: { type: Type.BOOLEAN }, notes: { type: Type.STRING } }
              }
            },
            required: ["isHighQuality", "detailedClinicalAnalysis", "dangerZones"]
          }
        }
      });

      return parseAIResponse(response.text) as ImageAnalysisResult;
    }, 3, true);
  });
};

// Image Generation
export const generateRealisticDentalImage = async (prompt: string, type: 'CLINICAL' | 'RADIOLOGY' | 'EXPLODED' = 'CLINICAL') => {
  const modelsToTry = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];
  
  try {
    return await withModelFallback(async (modelName, apiKey) => {
      return await withRetry(async (attempt) => {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        
        let finalPrompt = type === 'EXPLODED' 
          ? `Clean 3D medical illustration, exploded view, dental anatomy: ${prompt}. White background` 
          : type === 'RADIOLOGY' 
          ? `Digital Dental X-Ray: ${prompt}. Diagnostic grayscale` 
          : `Dental education visual aid: ${prompt}. High quality, photorealistic, clinical standard.`;
        
        let imageConfig: any = { aspectRatio: "16:9" };
        if (modelName.includes('pro-image')) imageConfig.imageSize = "1K";

        const response = await ai.models.generateContent({
          model: modelName, 
          contents: { parts: [{ text: finalPrompt }] },
          config: { imageConfig: imageConfig }
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
        throw new Error("No image data found in response");
      }, 2, true); 
    }, modelsToTry);
  } catch (e) {
    console.warn("All image generation attempts failed:", e);
    return null;
  }
};

export const checkApiConnection = () => {
    return !!getApiKey();
};