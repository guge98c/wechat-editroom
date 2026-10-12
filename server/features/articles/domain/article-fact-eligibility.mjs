import { isRepositoryEvent } from '../../research/domain/editorial-categories.mjs';

function list(value) { return Array.isArray(value) ? value.filter(Boolean) : []; }

function verifiedClaims(factBase = {}) {
  return list(factBase.claims).filter((claim) => claim && claim.status === 'verified');
}

/** Article qualification is evidence-based; editorial categories never waive this gate. */
export function evaluateArticleFactEligibility({ classification = {}, factBase = null, eventCard = null } = {}) {
  const repositoryProject = isRepositoryEvent({ ...classification, ...(eventCard || {}) });
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
  return {
    eligible: missing.length === 0,
    editorialCategory: classification.editorialCategory || classification.editorial_category || '',
    verifiedCount: verified.length,
    missing,
    status: missing.length ? 'blocked' : 'ready',
    reason: missing.length ? `文章事实门禁未通过：${missing.join('；')}` : '已通过通用文章事实门禁',
  };
}

