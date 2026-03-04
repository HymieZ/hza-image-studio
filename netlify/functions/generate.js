const { GoogleGenAI } = require("@google/genai");

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { prompt, imageData, mimeType, aspectRatio, model } = body;

  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing prompt" }) };
  }

  // Default to Nano Banana 2; allow override to Pro
  const ALLOWED_MODELS = [
    "gemini-3.1-flash-image-preview",
    "gemini-3-pro-image-preview"
  ];
  const selectedModel = ALLOWED_MODELS.includes(model) ? model : "gemini-3.1-flash-image-preview";

  try {
    const ai = new GoogleGenAI({ apiKey });

    let contents;
    if (imageData && mimeType) {
      contents = [
        {
          role: "user",
          parts: [
            { inlineData: { data: imageData, mimeType } },
            { text: prompt }
          ]
        }
      ];
    } else {
      contents = prompt;
    }

    const config = {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: {
        aspectRatio: aspectRatio || "1:1",
        imageSize: "1K",
      },
    };

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config,
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData?.data);
    const textPart = parts.find(p => p.text);

    if (!imagePart) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: textPart?.text || "No image generated. Try a different prompt." })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageData: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || "image/png",
        text: textPart?.text || null,
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
