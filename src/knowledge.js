import { CreateMLCEngine } from "@mlc-ai/web-llm";

class Knowledge {
  constructor() {
    this.engine = null;
  }

  async initLLM(callback) {
    this.engine = await CreateMLCEngine("Qwen2-0.5B-Instruct-q4f16_1-MLC", {
      initProgressCallback: callback
    });
  }

  async storeText(text, url, title) {
    const vectors = await this.getVectors();
    vectors.push({
      text,
      url,
      title,
      timestamp: Date.now()
    });
    await chrome.storage.local.set({ vectors });
  }

  async search(query, context = "") {
    const vectors = await this.getVectors();
    const relevantKnowledge = vectors.slice(-3); // Simplification: just get last 3 items

    const prompt = `Context: ${context}\n\nKnowledge:\n${
      relevantKnowledge.map(k => `Source (${k.title}): ${k.text}`).join('\n\n')
    }\n\nQuestion: ${query}\n\nAnswer:`;

    const response = await this.engine.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    return {
      response: response.choices[0].message.content,
      sources: relevantKnowledge
    };
  }

  async getVectors() {
    const result = await chrome.storage.local.get('vectors');
    return result.vectors || [];
  }
}

export default new Knowledge();