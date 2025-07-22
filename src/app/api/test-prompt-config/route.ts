import { NextResponse } from 'next/server';
import { SummaryPromptBuilder } from '@/lib/ai/summary-prompt';

export async function GET() {
  const config = SummaryPromptBuilder.getConfig();
  
  const samplePrompt = SummaryPromptBuilder.buildPrompt({
    title: 'Sample Article Title',
    author: 'Test Author',
    publishedDate: new Date().toLocaleDateString(),
    content: 'This is sample article content for testing the prompt configuration...'
  });

  return NextResponse.json({
    currentConfig: config,
    environmentVariables: {
      SUMMARY_WORD_COUNT: process.env.SUMMARY_WORD_COUNT || '(not set - using default)',
      SUMMARY_FOCUS: process.env.SUMMARY_FOCUS || '(not set - using default)',
      SUMMARY_STYLE: process.env.SUMMARY_STYLE || '(not set - using default)'
    },
    defaultValues: {
      wordCount: '150-175',
      focus: 'key facts, main arguments, and important conclusions',
      style: 'objective'
    },
    samplePrompt: samplePrompt.split('\n').slice(0, 5).join('\n') + '...' // First 5 lines only
  });
}