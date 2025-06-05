import { Layout } from '@/components/layout/layout';
import { AuthGuard } from '@/components/auth/auth-guard';

// Mock article data for demonstration
const mockArticles = [
  {
    id: '1',
    title: "Apple's October Event Announced",
    source: 'The Verge',
    publishedAt: '2 hours ago',
    isRead: false,
    hasSummary: false,
    excerpt: 'Apple has officially announced their October event focusing on new Macs and iPads. The event will be held virtually on...',
  },
  {
    id: '2',
    title: "Microsoft's New AI Strategy",
    source: 'TechCrunch',
    publishedAt: '3 hours ago',
    isRead: false,
    hasSummary: true,
    excerpt: 'Microsoft announces major shift in AI development approach with focus on enterprise integration and ethical AI principles. The company plans to invest $10B...',
  },
  {
    id: '3',
    title: 'Google Pixel 9 Review',
    source: '9to5Mac',
    publishedAt: '5 hours ago',
    isRead: true,
    hasSummary: false,
    excerpt: 'The Pixel 9 brings meaningful improvements to Google\'s flagship...',
  },
];

export default function Home() {
  return (
    <AuthGuard>
      <Layout>
        <div className="container mx-auto px-4 py-6">
          <div className="space-y-4">
            {mockArticles.map((article) => (
              <article
                key={article.id}
                className="article-list-item cursor-pointer rounded-lg border p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-semibold">{article.title}</h2>
                      {article.hasSummary && (
                        <span className="text-yellow-500">⚡</span>
                      )}
                      {!article.hasSummary && (
                        <button className="text-gray-400 hover:text-yellow-500">
                          ⚡
                        </button>
                      )}
                    </div>
                    <div className="mt-1 flex items-center space-x-2 text-sm text-muted-foreground">
                      <span>{article.source}</span>
                      <span>•</span>
                      <span>{article.publishedAt}</span>
                      <span>{article.isRead ? '○' : '•'}</span>
                    </div>
                    <div className="mt-3 border-t pt-3">
                      {article.hasSummary && (
                        <div className="text-sm text-blue-600 dark:text-blue-400">
                          🤖 {article.excerpt}
                        </div>
                      )}
                      {!article.hasSummary && (
                        <div className="text-sm text-muted-foreground">
                          {article.excerpt}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Layout>
    </AuthGuard>
  );
}
