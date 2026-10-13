import { isRepositoryEvent } from '../../research/domain/editorial-categories.mjs';

function list(value) { return Array.isArray(value) ? value.filter(Boolean) : []; }

function verifiedClaims(factBase = {}) {
  return list(factBase.claims).filter((claim) => claim && claim.status === 'verified');
}

/** Article qualification is evidence-based; editorial categories never waive this gate. */
export function evaluateArticleFactEligibility({ classification = {}, factBase = null, eventCard = null } = {}) {
  const contentClass = String(classification.contentClass || classification.content_class || '').trim();
  const repositoryProject = contentClass === 'github_project' || isRepositoryEvent({ ...classification, ...(eventCard || {}) });
  const routeApproved = classification.articleRouteApproved === true || classification.article_route_approved === true;
  const explicitlyApproved = routeApproved || (!repositoryProject && (classification.articleEligible === true || classification.article_eligible === true));
  const verified = verifiedClaims(factBase || {});
  const missing = [];
  if (repositoryProject && !explicitlyApproved) {
    return { eligible: false, editorialCategory: classification.editorialCategory || classification.editorial_category || '',
      verifiedCount: verified.length, missing: ['人工明确选入文章路线'], status: 'blocked', reason: 'GitHub 项目默认只进入项目图文路线' };
  }
  if (!factBase) return { eligible: !repositoryProject || explicitlyApproved,
    editorialCategory: classification.editorialCategory || classification.editorial_category || '',
    verifiedCount: null, missing: [], status: 'pending', reason: '' };
  if (!verified.length) missing.push('至少 1 条 status=verified 的事实');
  const features = classification.features || classification.classification_features || {};
  const evidence = list(classification.evidence || classification.classificationEvidence || classification.classification_evidence);
  if (contentClass === 'open_source_technology'
    && !(features.hasTechnicalDocs || features.hasPaper || features.hasBenchmark || evidence.some((item) => item?.role === 'technical_mechanism')) ) {
    missing.push('技术机制、架构或性能证据');
  }
  if (contentClass === 'open_source_trend'
    && !(Number(features.independentSourceCount || 0) >= 2 || Number(features.subjectCount || 0) >= 2 || features.hasAdoptionSignal && Number(features.independentSourceCount || 0) >= 2)) {
    missing.push('多来源、跨主体或生态变化证据');
  }
  return {
    eligible: missing.length === 0,
    editorialCategory: classification.editorialCategory || classification.editorial_category || '',
    verifiedCount: verified.length,
    missing,
    status: missing.length ? 'blocked' : 'ready',
    reason: missing.length ? `文章事实门禁未通过：${missing.join('；')}` : '已通过通用文章事实门禁',
  };
}

