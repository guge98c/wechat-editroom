import crypto from 'node:crypto';

function textOf(event = {}) {
  const normalized = event.normalized || {};
  return [normalized.objectLabel, normalized.topicLabel, normalized.objectKey,
    event.title, event.representative_title, event.titleText].filter(Boolean).join(' ').toLowerCase();
}

function modelReleaseOf(event = {}) {
  const action = String(event.normalized?.actionType || event.action_type || '').toLowerCase();
  if (action && !['发布', '更新', '开源', 'launch', 'release', 'update'].some((part) => action.includes(part))) return null;
  const text = textOf(event).replace(/[._-]+/g, ' ').replace(/\s+/g, ' ');
  const who = String(event.normalized?.whoKey || event.whoKey || '').toLowerCase();
  let match = text.match(/\bclaude\s+(?:(opus|sonnet|haiku)\s+)?v?(\d+(?:\.\d+)+|\d+)\b/i);
  if (match) {
    const tier = String(match[1] || '').toLowerCase();
    const version = match[2].replace(/^v/i, '');
    return { family: 'claude', version, variant: tier || 'unspecified', label: `Claude ${version}` };
  }
  if (/anthropic/.test(who)) {
    match = text.match(/\b(opus|sonnet|haiku)\s+v?(\d+(?:\.\d+)+|\d+)\b/i);
    if (match) return { family: 'claude', version: match[2], variant: match[1].toLowerCase(), label: `Claude ${match[2]}` };
    match = text.replace(/[^a-z0-9]/g, '').match(/(opus|sonnet|haiku)(\d)(\d+)$/i);
    if (match) {
      const version = `${match[2]}.${match[3]}`;
      return { family: 'claude', version, variant: match[1].toLowerCase(), label: `Claude ${version}` };
    }
  }
  match = text.match(/\b(gemini|deepseek|gpt|qwen|kimi|glm|minimax|grok|llama|mistral)\s+v?(\d+(?:\.\d+)+|\d+)\b/i);
  if (match) {
    const family = match[1].toLowerCase();
    const version = match[2].replace(/^v/i, '');
    const variantMatch = text.match(new RegExp(`\\b${family}\\s+v?${version.replaceAll('.', '\\.')}\\s+([a-z][a-z0-9-]*)`, 'i'));
    return { family, version, variant: variantMatch?.[1]?.toLowerCase() || 'unspecified', label: `${family === 'gpt' ? 'GPT' : family[0].toUpperCase() + family.slice(1)} ${version}` };
  }
  // Compact normalized object keys such as "claudesonnet55" lose separators.
  return null;
}

function occurrenceTime(item = {}) {
  const value = item.firstSeenAt || item.lastSeenAt || item.normalized?.timeWindow || item.first_seen_at || item.last_seen_at || '';
  const parsed = Date.parse(String(value).length === 7 ? `${value}-01` : value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function distinctVariants(members) {
  return new Set(members.map((member) => modelReleaseOf(member)?.variant).filter((variant) => variant && variant !== 'unspecified')).size > 1;
}

export function buildEventTopicGroups(items = [], { maxDaysApart = 21 } = {}) {
  const candidates = new Map();
  for (const item of items) {
    const model = modelReleaseOf(item);
    const who = String(item.normalized?.whoKey || item.whoKey || '').trim().toLowerCase();
    if (!model || !who || !item.eventId) continue;
    const key = `${who}|${model.family}|${model.version}`;
    if (!candidates.has(key)) candidates.set(key, []);
    candidates.get(key).push({ item, model });
  }
  const groups = [];
  for (const [key, entries] of candidates) {
    if (entries.length < 2 || !distinctVariants(entries.map(({ item }) => item))) continue;
    const dated = entries.map(({ item }) => occurrenceTime(item)).filter(Boolean);
    if (dated.length > 1 && (Math.max(...dated) - Math.min(...dated)) / 86400000 > maxDaysApart) continue;
    const memberItems = entries.map(({ item }) => item).sort((a, b) => Number(a.rank || Infinity) - Number(b.rank || Infinity));
    const label = entries[0].model.label;
    const whoLabel = String(entries[0].item.normalized?.whoKey || '相关主体');
    const displayWho = whoLabel.toLowerCase() === 'anthropic' ? 'Anthropic' : whoLabel;
    const ids = memberItems.map((item) => String(item.eventId)).sort();
    const id = `TG${crypto.createHash('sha1').update(key).digest('hex').slice(0, 10).toUpperCase()}`;
    groups.push({
      topicGroupId: id,
      title: `${displayWho} ${label} 系列发布`,
      relationshipType: 'SAME_SERIES_RELEASE',
      mergePolicy: 'aggregate_display_only',
      memberEventIds: ids,
      memberCount: ids.length,
      maxDaysApart,
      items: memberItems.map((item) => ({
        eventId: item.eventId,
        title: item.title,
        rank: item.rank,
        scoreValue: item.scoreValue,
        editorialCategory: item.editorialCategory,
        state: item.state,
        reportCount: item.reportCount,
        sourceCount: item.sourceCount,
      })),
      scoreValue: Math.max(...memberItems.map((item) => Number(item.scoreValue) || 0)),
      rank: Math.min(...memberItems.map((item) => Number(item.rank) || Infinity)),
    });
  }
  return groups.sort((a, b) => a.rank - b.rank || a.topicGroupId.localeCompare(b.topicGroupId));
}

export function displayItemsForTopicGroups(items = [], groups = []) {
  const scopedGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((member) => items.some((candidate) => String(candidate.eventId) === member.eventId)),
  })).filter((group) => group.items.length > 1);
  for (const group of scopedGroups) {
    group.memberEventIds = group.items.map((item) => item.eventId);
    group.rank = Math.min(...group.items.map((member) => Number(items.find((candidate) => String(candidate.eventId) === member.eventId)?.rank) || Infinity));
  }
  const groupByEvent = new Map(scopedGroups.flatMap((group) => group.memberEventIds.map((eventId) => [eventId, group])));
  const emitted = new Set();
  const result = [];
  for (const item of items) {
    const group = groupByEvent.get(String(item.eventId));
    if (!group) {
      result.push({ ...item, displayKind: 'event' });
      continue;
    }
    if (emitted.has(group.topicGroupId)) continue;
    emitted.add(group.topicGroupId);
    const memberItems = group.items.map((member) => items.find((candidate) => String(candidate.eventId) === member.eventId) || member);
    const lead = memberItems.reduce((best, candidate) => !best || Number(candidate.scoreValue) > Number(best.scoreValue) ? candidate : best, null);
    result.push({
      ...lead,
      eventId: group.topicGroupId,
      title: group.title,
      rank: group.rank,
      scoreValue: Math.max(...memberItems.map((member) => Number(member.scoreValue) || 0)),
      reportCount: memberItems.reduce((sum, member) => sum + Number(member.reportCount || 0), 0),
      sourceCount: new Set(memberItems.flatMap((member) => member.sourceGroups || [])).size || Math.max(...memberItems.map((member) => Number(member.sourceCount || 0)), 0),
      displayKind: 'topic_group',
      relationshipType: group.relationshipType,
      topicGroupId: group.topicGroupId,
      childItems: memberItems,
    });
  }
  return result.sort((a, b) => Number(a.rank || Infinity) - Number(b.rank || Infinity)
    || Number(b.scoreValue || 0) - Number(a.scoreValue || 0));
}
