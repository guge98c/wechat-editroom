export const SOCIAL_ROUTE_VERSION = 3;

const MATERIAL_ROUTES = Object.freeze({
  repository: { contentType: 'repository', storyboardSkill: 'repository-card-storyboard', poolRole: 'AI 工具图文预选', labels: { wechat: '工具图文', xiaohongshu: '工具图文' } },
  event: { contentType: 'event', storyboardSkill: 'event-card-storyboard', poolRole: 'AI 事件图文预选', labels: { wechat: '事件图文', xiaohongshu: '事件图文' } },
  custom: { contentType: 'custom', storyboardSkill: 'custom-card-storyboard', poolRole: '自定义图文', labels: { wechat: '自定义图文', xiaohongshu: '自定义图文' } },
});

function isRepositoryCandidate(candidate = {}) {
  if (candidate.repositoryMeta || candidate.repository_meta || candidate.material_type === 'repository') return true;
  return (Array.isArray(candidate.articles) ? candidate.articles : []).some((article) => /github\.com\//i.test(String(article?.url || '')))
    || /^https:\/\/github\.com\//i.test(String(candidate.url || ''));
}

export function socialRouteForMaterialType(materialType, channel = 'wechat') {
  const type = Object.hasOwn(MATERIAL_ROUTES, materialType) ? materialType : 'event';
  const entry = MATERIAL_ROUTES[type];
  const targetChannel = channel === 'xiaohongshu' ? 'xiaohongshu' : 'wechat';
  return { materialType: type, ...entry, outputMode: `${targetChannel}-${type === 'repository' ? 'tool' : type === 'custom' ? 'custom' : 'event'}-cards`, label: entry.labels[targetChannel], channel: targetChannel, routeVersion: SOCIAL_ROUTE_VERSION };
}

export function socialRouteForContentType(type, channel = 'wechat') {
  return socialRouteForMaterialType(type, channel);
}

export function contentTypeForSocialRoute(candidate = {}) {
  if (candidate.output_mode?.includes('custom-cards')) return 'custom';
  return isRepositoryCandidate(candidate) ? 'repository' : 'event';
}

export function socialStoryboardSkillForMaterialType(materialType) {
  return socialRouteForMaterialType(materialType).storyboardSkill;
}

export function socialStoryboardClassForMaterialType(materialType) {
  return materialType === 'custom' ? 'custom' : materialType === 'repository' ? 'repository' : 'event';
}

export function socialRouteForCandidate(candidate = {}, channel = 'wechat') {
  return socialRouteForMaterialType(contentTypeForSocialRoute(candidate), channel);
}
