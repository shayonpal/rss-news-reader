// Debug script to check tag store state
const tagStoreState = JSON.parse(localStorage.getItem('tag-store') || '{}');
console.log('Tag Store State:', tagStoreState);

if (tagStoreState.state?.tags) {
  const tags = tagStoreState.state.tags;
  console.log('Tags in store:', tags);
  
  // Check for unreadCount field
  Object.entries(tags).forEach(([id, tag]) => {
    console.log(`Tag ${tag.name}:`, {
      articleCount: tag.articleCount,
      unreadCount: tag.unreadCount,
      totalCount: tag.totalCount
    });
  });
} else {
  console.log('No tags found in store');
}