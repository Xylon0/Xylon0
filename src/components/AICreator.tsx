import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const AICreator = () => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateVariation = async () => {
    if (!image || !prompt) return;
    setLoading(true);
    try {
      const base64Data = image.split(',')[1];
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
            { text: `Generate a variation of this logo based on the prompt: ${prompt}` },
          ],
        },
      });
      
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
        }
      }
    } catch (error) {
      console.error('Error generating logo:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white/5 rounded-[12px] border border-white/10 backdrop-blur-sm">
      <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <span className="text-primary">✨</span> AI Logo Creator
      </h3>
      <div className="space-y-4">
        <input type="file" onChange={handleImageUpload} className="block w-full text-sm text-white/50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/80" />
        {image && <img src={image} alt="Original" className="w-32 h-32 object-cover rounded-[12px]" />}
        <input 
          type="text" 
          value={prompt} 
          onChange={(e) => setPrompt(e.target.value)} 
          placeholder="Enter prompt for variation..." 
          className="w-full p-3 rounded-[12px] bg-white/5 border border-white/10 text-white"
        />
        <button 
          onClick={generateVariation} 
          disabled={loading || !image || !prompt}
          className="w-full py-3 bg-primary text-white rounded-[12px] font-bold hover:bg-primary/80 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <span className="animate-spin">⏳</span> : <span>✨</span>}
          Generate
        </button>
        {generatedImage && (
          <div className="mt-6">
            <p className="mb-2 text-sm text-white/50">Generated Variation:</p>
            <img src={generatedImage} alt="Generated" className="w-full rounded-[12px]" />
          </div>
        )}
      </div>
    </div>
  );
};
