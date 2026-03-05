import { GoogleGenAI, Modality } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const geminiService = {
  async getTrafficInfo(location: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide current traffic status and estimated travel time for flower transport from farm to ${location}.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text;
  },

  async analyzeVehicleImage(base64Image: string) {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Analyze this vehicle image for any visible damage or maintenance issues before the trip starts." }
        ]
      }
    });
    return response.text;
  },

  async speak(text: string) {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0)).buffer;
        
        // Gemini TTS returns a WAV/MP3 container usually, but let's try decodeAudioData first
        // If it's raw PCM, we'd need a different approach, but usually it's a standard format
        audioContext.decodeAudioData(audioData, (buffer) => {
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContext.destination);
          source.start(0);
        }, (err) => {
          console.error("Error decoding audio data", err);
          // Fallback to basic Audio element if decode fails
          const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
          audio.play().catch(e => console.error("Audio playback failed", e));
        });
      }
    } catch (err) {
      console.error("Speech failed", err);
    }
  }
};
