import { groupApi } from '../../server/group-challenges.mjs';

export default async request => {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  return groupApi(request, parts[parts.length - 1] === 'groups' ? '' : parts.at(-1));
};

export const config = { path: '/api/groups/*', rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
