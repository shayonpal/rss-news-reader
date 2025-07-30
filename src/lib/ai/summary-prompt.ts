interface SummaryPromptConfig {
  wordCount: string;
  focus: string;
  style: string;
}

export class SummaryPromptBuilder {
  private static readonly DEFAULTS: SummaryPromptConfig = {
    wordCount: "150-175",
    focus: "key facts, main arguments, and important conclusions",
    style: "objective",
  };

  static getConfig(): SummaryPromptConfig {
    return {
      wordCount: process.env.SUMMARY_WORD_COUNT || this.DEFAULTS.wordCount,
      focus: process.env.SUMMARY_FOCUS || this.DEFAULTS.focus,
      style: process.env.SUMMARY_STYLE || this.DEFAULTS.style,
    };
  }

  static buildPrompt(articleData: {
    title?: string;
    author?: string;
    publishedDate?: string;
    content: string;
  }): string {
    const config = this.getConfig();

    const prompt = `You are a news summarization assistant. Create a ${config.style} summary of the following article in ${config.wordCount} words. Focus on ${config.focus}. Maintain objectivity and preserve the author's core message.

IMPORTANT: Do NOT include the article title in your summary. Start directly with the content summary.

Article Details:
Title: ${articleData.title || "Untitled"}
Author: ${articleData.author || "Unknown"}
Published: ${articleData.publishedDate || "Unknown"}

Article Content:
${articleData.content}

Write a clear, informative summary that captures the essence of this article without repeating the title.`;

    return prompt;
  }
}
