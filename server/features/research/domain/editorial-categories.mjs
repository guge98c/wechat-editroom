export const EDITORIAL_CATEGORIES = Object.freeze([
  '产品与技术动态',
  '大厂与商业战略',
  '职场与组织变化',
  '开源项目与开发者生态',
  '行业趋势与市场变化',
  '政策与公共议题',
]);

const LEGACY_TOPIC_CATEGORY_MAP = Object.freeze({
  '🤖 AI/技术动态': '产品与技术动态',
  '🏢 大厂战略': '大厂与商业战略',
  '📈 行业趋势': '行业趋势与市场变化',
  '💼 职场生态': '职场与组织变化',
});

export function normalizeEditorialCategory(value, { repository = false } = {}) {
  if (repository) return '开源项目与开发者生态';
  const category = String(value || '').trim();
  if (EDITORIAL_CATEGORIES.includes(category)) return category;
  return LEGACY_TOPIC_CATEGORY_MAP[category] || '';
}

export function isRepositoryEvent(event = {}) {
  const contentClass = String(event.contentClass || event.content_class || event.classification?.contentClass || event.classification?.content_class || event.classification_snapshot?.content_class || '');
  if (contentClass === 'github_project') return true;
  if (event.material_type === 'repository' || event.materialType === 'repository' || event.repositoryMeta || event.repository_meta) return true;
  return (Array.isArray(event.articles) ? event.articles : []).some((article) => {
    const source = String(article?.source || article?.channel || '').toLowerCase();
    const url = String(article?.url || '').toLowerCase();
    return source === 'github' || /github\.com\//.test(url);
  });
}
