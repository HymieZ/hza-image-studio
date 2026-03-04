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

  const { prompt, imageData, mimeType, aspectRatio } = body;

  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing prompt" }) };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Build contents array
    const parts = [];
    
    // Add reference image if provided
    if (imageData && mimeType) {
      parts.push({ inlineData: { data: imageData, mimeType } });
    }
    
    parts.push({ text: prompt });

    const contents = [{ role: "user", parts }];

    const config = {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: {
        aspectRatio: aspectRatio || "1:1",
        imageSize: "1K",
      },
    };

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents,
      config,
    });

    // Extract image from response
    const candidate = response.candidates?.[0];
    if (!candidate) {
      return { statusCode: 500, body: JSON.stringify({ error: "No candidates returned" }) };
    }

    const imagePart = candidate.content?.parts?.find(p => p.inlineData?.data);
    const textPart = candidate.content?.parts?.find(p => p.text);

    if (!imagePart) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: textPart?.text || "No image generated" }) 
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageData: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType,
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
