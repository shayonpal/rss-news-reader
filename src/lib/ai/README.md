# AI Summarization Configuration

The summarization prompt can be customized through environment variables to adapt to different content types and use cases.

## Environment Variables

- **`SUMMARY_WORD_COUNT`** - Target word count for summaries (e.g., "150-175", "200")
- **`SUMMARY_FOCUS`** - What aspects to focus on in the summary
- **`SUMMARY_STYLE`** - Writing style for the summary (e.g., "objective", "conversational")

## Configuration Examples

### Default News Summarization

```env
SUMMARY_WORD_COUNT=150-175
SUMMARY_FOCUS=key facts, main arguments, and important conclusions
SUMMARY_STYLE=objective
```

### Technical Blog Posts

```env
SUMMARY_WORD_COUNT=200-250
SUMMARY_FOCUS=technical details, implementation steps, and code concepts
SUMMARY_STYLE=technical and detailed
```

### Executive Summaries

```env
SUMMARY_WORD_COUNT=100-125
SUMMARY_FOCUS=business impact, key decisions, and action items
SUMMARY_STYLE=concise and actionable
```

### Academic Papers

```env
SUMMARY_WORD_COUNT=250-300
SUMMARY_FOCUS=research methodology, findings, and implications
SUMMARY_STYLE=academic and analytical
```

### Quick News Digest

```env
SUMMARY_WORD_COUNT=75-100
SUMMARY_FOCUS=who, what, when, where, why
SUMMARY_STYLE=journalistic
```

## Prompt Engineering Best Practices

1. **Word Count**:

   - Use ranges (e.g., "150-175") for flexibility
   - Consider the typical length of your content sources
   - Shorter summaries (75-125 words) for quick scanning
   - Longer summaries (200-300 words) for detailed analysis

2. **Focus Areas**:

   - Be specific about what information to extract
   - List multiple aspects separated by commas
   - Consider your audience's information needs
   - Examples: "key statistics", "controversial points", "future implications"

3. **Writing Style**:
   - Match the style to your use case
   - "objective" for neutral news summaries
   - "technical" for developer-focused content
   - "conversational" for casual reading
   - "analytical" for in-depth insights

## Technical Details

- Configuration values are loaded at runtime from environment variables
- Invalid or missing values silently fall back to defaults
- Changes require server restart to take effect
- The configuration is provider-agnostic and will work with future LLM providers

## Default Values

If no environment variables are set, the system uses these defaults:

- Word Count: `150-175`
- Focus: `key facts, main arguments, and important conclusions`
- Style: `objective`

## Future Enhancement

This configuration system is designed to work seamlessly with multi-provider LLM support (TODO-024), allowing the same prompt configuration to be used across different AI providers.
