export interface Article {
  id: number;
  title: string;
  excerpt: string;
  source: string;
  published_at: string;
  category: string;
  url?: string;
  is_read?: boolean;
  created_at?: string;
  ai_summary?: string;
  is_summarized?: boolean;
  is_bookmarked?: boolean;
  feed_id?: number;
}

export interface Feed {
  id: number;
  title: string;
  url: string;
  folder_id: number;
  unread_count?: number;
}

export interface Folder {
  inoreader_id: number;
  name: string;
  feeds?: Feed[];
}

// Mock AI summarization function
export const generateAISummary = async (articleText: string): Promise<string> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const summaries = [
    "AI analysis reveals key insights about technological advancement and its impact on modern society. The research demonstrates significant improvements in efficiency and user experience.",
    "This breakthrough represents a major step forward in scientific understanding, with potential applications across multiple industries. Experts predict widespread adoption within the next few years.",
    "The study highlights important environmental considerations and sustainable practices. Researchers emphasize the need for continued innovation in green technology solutions.",
    "New findings challenge conventional wisdom and open doors to revolutionary approaches. The implications could reshape how we think about this field entirely.",
    "Data shows promising results for future development, with early trials exceeding expectations. Industry leaders are optimistic about commercial viability and market potential."
  ];
  
  return summaries[Math.floor(Math.random() * summaries.length)];
};

function generateMockFolders(): Folder[] {
  return [
    {
      inoreader_id: 1,
      name: 'Technology'
    },
    {
      inoreader_id: 2,
      name: 'News & Politics'
    },
    {
      inoreader_id: 3,
      name: 'Science & Research'
    },
    {
      inoreader_id: 4,
      name: 'Design & Culture'
    },
    {
      inoreader_id: 5,
      name: 'Business & Finance'
    }
  ];
}

function generateMockFeeds(): Feed[] {
  return [
    // Technology folder
    { id: 1, title: 'TechCrunch', url: 'https://techcrunch.com/feed/', folder_id: 1, unread_count: 12 },
    { id: 2, title: 'The Verge', url: 'https://theverge.com/rss/index.xml', folder_id: 1, unread_count: 8 },
    { id: 3, title: 'Ars Technica', url: 'https://arstechnica.com/feed/', folder_id: 1, unread_count: 5 },
    { id: 4, title: 'Wired', url: 'https://wired.com/feed/', folder_id: 1, unread_count: 15 },
    
    // News & Politics folder
    { id: 5, title: 'BBC News', url: 'https://bbc.com/news/rss.xml', folder_id: 2, unread_count: 23 },
    { id: 6, title: 'Reuters', url: 'https://reuters.com/rss/', folder_id: 2, unread_count: 18 },
    { id: 7, title: 'Associated Press', url: 'https://apnews.com/rss/', folder_id: 2, unread_count: 7 },
    
    // Science & Research folder
    { id: 8, title: 'Nature', url: 'https://nature.com/nature.rss', folder_id: 3, unread_count: 3 },
    { id: 9, title: 'Science Daily', url: 'https://sciencedaily.com/rss/all.xml', folder_id: 3, unread_count: 9 },
    { id: 10, title: 'MIT Technology Review', url: 'https://technologyreview.com/feed/', folder_id: 3, unread_count: 4 },
    { id: 11, title: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/rss/', folder_id: 3 }, // No unread count
    
    // Design & Culture folder
    { id: 12, title: 'Dezeen', url: 'https://dezeen.com/feed/', folder_id: 4, unread_count: 6 },
    { id: 13, title: 'Core77', url: 'https://core77.com/rss/', folder_id: 4, unread_count: 2 },
    { id: 14, title: 'Fast Company Design', url: 'https://fastcompany.com/design/rss', folder_id: 4 }, // No unread count
    
    // Business & Finance folder
    { id: 15, title: 'Harvard Business Review', url: 'https://hbr.org/feed', folder_id: 5, unread_count: 11 },
    { id: 16, title: 'Fast Company', url: 'https://fastcompany.com/rss/', folder_id: 5, unread_count: 14 },
    { id: 17, title: 'Forbes Tech', url: 'https://forbes.com/technology/feed/', folder_id: 5, unread_count: 9 }
  ];
}

function generateMockArticles(count: number): Article[] {
  const sources = ['TechCrunch', 'Wired', 'The Verge', 'Ars Technica', 'MIT Technology Review', 'IEEE Spectrum', 'Nature', 'Science Daily', 'Fast Company', 'Harvard Business Review'];
  const categories = ['Technology', 'Science', 'Design', 'Space', 'Fashion', 'Health', 'Environment', 'Business', 'Food', 'News', 'Politics', 'Sports', 'Entertainment'];
  
  const titles = [
    'Revolutionary AI Model Breaks New Ground in Natural Language Processing',
    'Scientists Discover Breakthrough in Quantum Computing Error Correction',
    'The Future of Sustainable Energy: Solar Panel Efficiency Reaches 50%',
    'New Study Reveals Hidden Patterns in Human Memory Formation',
    'SpaceX Successfully Tests New Starship Heat Shield Technology',
    'Breakthrough Gene Therapy Shows Promise for Treating Rare Diseases',
    'Climate Scientists Develop New Carbon Capture Technology',
    'The Rise of Decentralized Social Media Platforms',
    'Revolutionary Battery Technology Could Transform Electric Vehicles',
    'New Archaeological Discovery Sheds Light on Ancient Civilizations',
    'Artificial Intelligence Helps Doctors Diagnose Diseases Earlier',
    'The Psychology Behind Successful Remote Team Collaboration',
    'Advanced Materials Science Creates Self-Healing Concrete',
    'Ocean Conservation Efforts Show Promising Results',
    'The Future of Food: Lab-Grown Meat Industry Expands Rapidly',
    'Cybersecurity Experts Warn of New Threats in 2025',
    'Virtual Reality Technology Transforms Education Methods',
    'Renewable Energy Storage Solutions Become More Efficient',
    'Medical Researchers Make Progress in Alzheimer\'s Treatment',
    'The Evolution of Electric Aviation Technology'
  ];

  const excerpts = [
    'Researchers have developed a groundbreaking approach that could revolutionize how we interact with artificial intelligence systems. The new model demonstrates unprecedented accuracy in understanding context and nuance in human communication, opening doors to more natural and intuitive AI interactions.',
    'A team of international scientists has achieved a major milestone in quantum computing by developing a new error correction method that significantly reduces computational errors. This advancement brings us closer to practical quantum computers that could solve complex problems.',
    'Engineers have created solar panels with record-breaking efficiency rates, potentially transforming the renewable energy landscape. The new technology uses advanced materials and innovative design principles to capture and convert sunlight more effectively than ever before.',
    'Neuroscientists have uncovered fascinating insights into how the human brain forms and stores memories. The research reveals previously unknown mechanisms that could lead to new treatments for memory-related disorders and cognitive enhancement techniques.',
    'The latest test of SpaceX\'s Starship heat shield technology has exceeded expectations, demonstrating the vehicle\'s capability to withstand extreme temperatures during atmospheric reentry. This success marks another step toward making space travel more accessible and routine.',
    'Medical researchers have developed a promising gene therapy approach that shows remarkable results in treating previously incurable genetic disorders. The treatment method offers hope to patients and families affected by rare diseases worldwide.',
    'Environmental scientists have created an innovative carbon capture system that could significantly impact global climate change efforts. The technology offers a practical solution for removing carbon dioxide from the atmosphere at an unprecedented scale.',
    'The emergence of decentralized social media platforms represents a fundamental shift in how people connect and share information online. These new platforms prioritize user privacy and data ownership while fostering genuine community connections.',
    'A breakthrough in battery technology promises to revolutionize electric vehicle adoption by offering faster charging times and longer range capabilities. The new battery design addresses the main concerns that have historically limited EV acceptance among consumers.',
    'Archaeologists have made an extraordinary discovery that provides new insights into ancient civilizations and their technological capabilities. The findings challenge our understanding of historical timelines and cultural development patterns.'
  ];

  return Array.from({ length: count }, (_, index) => {
    const now = new Date();
    const publishedDate = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const isRead = Math.random() > 0.4;
    const isSummarized = Math.random() > 0.7; // 30% chance of being summarized
    const isBookmarked = Math.random() > 0.8; // 20% chance of being bookmarked
    
    return {
      id: index + 1,
      title: titles[index % titles.length] + (index >= titles.length ? ` (Part ${Math.floor(index / titles.length) + 1})` : ''),
      excerpt: excerpts[index % excerpts.length],
      source: sources[index % sources.length],
      published_at: publishedDate.toISOString(),
      category: categories[index % categories.length],
      url: `https://example.com/article-${index + 1}`,
      is_read: isRead,
      is_summarized: isSummarized,
      is_bookmarked: isBookmarked,
      ai_summary: isSummarized ? 'AI-generated summary: This article provides comprehensive insights into recent developments and their broader implications for the industry.' : undefined,
      created_at: publishedDate.toISOString(),
      feed_id: Math.floor(Math.random() * 17) + 1 // Random feed ID from 1-17
    };
  });
}

// Mock Supabase client for demo purposes
const mockSupabaseClient = {
  from: (table: string) => ({
    select: (columns: string) => {
      // Create a query builder that can handle different chain patterns
      const queryBuilder = {
        order: (column: string, options?: any) => {
          // Return data directly from order, since some queries don't call limit
          const result = {
            data: table === 'articles' 
              ? generateMockArticles(40) 
              : table === 'feeds' 
                ? generateMockFeeds()
                : table === 'folders'
                  ? generateMockFolders()
                  : [],
            error: null
          };
          
          // Also provide limit method for compatibility
          result.limit = (count: number) => ({
            data: table === 'articles' ? generateMockArticles(count) : result.data,
            error: null
          });
          
          return result;
        },
        limit: (count: number) => ({
          data: table === 'articles' ? generateMockArticles(count) : [],
          error: null
        }),
        eq: (column: string, value: any) => ({
          data: (() => {
            if (table === 'feeds' && column === 'folder_id') {
              return generateMockFeeds().filter(feed => feed.folder_id === value);
            }
            if (table === 'feeds' && column === 'id') {
              return generateMockFeeds().filter(feed => feed.id === value);
            }
            if (table === 'articles') {
              return generateMockArticles(40).filter((_, i) => i < 5);
            }
            return [];
          })(),
          error: null
        })
      };
      
      return queryBuilder;
    },
    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        data: null,
        error: null
      })
    })
  })
};

export const supabase = mockSupabaseClient;