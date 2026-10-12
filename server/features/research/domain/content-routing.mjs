import { isRepositoryEvent } from './editorial-categories.mjs';

/** Repository origin is provenance, not an editorial category. */
export function isPureProjectEvent(event = {}) {
  return isRepositoryEvent(event)
    || String(event.source_group || event.source_type || event.source || '').toLowerCase() === 'github'
    || /^https:\/\/github\.com\//i.test(String(event.url || ''));
}

/** Choose a production route from source material and an explicit editorial decision. */
export function classifyContentRoute(card = {}, { event = null, requestedRoute = '' } = {}) {
  const project = isPureProjectEvent({ ...(event || {}), ...card, articles: card.articles || event?.articles || [] });
  const manuallyApproved = requestedRoute === 'article'
    || card.articleRouteApproved === true || card.article_route_approved === true;
  if (project && !manuallyApproved) {
    return {
      contentRoute: 'social_only', articleEligible: false, pureProject: true,
      warning: 'GitHub 项目默认进入项目图文路线；文章路线需要人工选题并通过事实门禁',
    };
  }
  if (project && manuallyApproved) {
    return {
      contentRoute: 'manual_review', articleEligible: true, pureProject: true,
      warning: '项目已由编辑明确选入文章路线，仍需通过文章事实门禁',
    };
  }
  if (card.articleEligible === false || card.article_eligible === false) {
    return { contentRoute: 'editorial_review', articleEligible: false, pureProject: false, warning: card.articleEligibilityReason || card.article_eligibility_reason || '编辑资格待确认' };
  }
  return { contentRoute: 'article', articleEligible: true, pureProject: false, warning: '' };
}

export function scoreStatusForCard(card = {}) {
  const source = card.source || {};
  const rawEventValue = source.eventValue ?? source.t ?? source.eventHeatScore;
  const hasEventValue = rawEventValue !== null && rawEventValue !== undefined && Number.isFinite(Number(rawEventValue));
  if (source.scoreStatus === 'needs_source_data' || source.composite && !hasEventValue) {
    return { scoreStatus: 'needs_source_data', scoreWarning: source.scoreWarning || '缺少事件价值 T 或可核验事实，暂不生成正式 F 分' };
  }
  return { scoreStatus: 'ready', scoreWarning: '' };
}
