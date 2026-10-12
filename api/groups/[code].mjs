import { groupApi } from '../../server/group-challenges.mjs';

export default (request, context) => {
  const code = context?.params?.code || new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
  return groupApi(request, code);
};
