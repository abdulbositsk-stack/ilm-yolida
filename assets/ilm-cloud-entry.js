import { createClient } from '@supabase/supabase-js';

const config = window.ILM_SUPABASE_CONFIG || {};
const configured = Boolean(config.url && config.anonKey);
const client = configured ? createClient(config.url, config.anonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
}) : null;
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
let currentUser = null;
let syncInFlight = null;

async function uploadImageData(dataUrl, folder, id, user = currentUser) {
  if (!client || !user || !String(dataUrl || '').startsWith('data:image/')) return dataUrl || '';
  const blob = await (await fetch(dataUrl)).blob();
  if (!['image/jpeg','image/png','image/webp'].includes(blob.type) || blob.size > 2 * 1024 * 1024) throw new Error('Rasm 2 MB dan kichik JPG, PNG yoki WebP bo‘lsin.');
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${user.id}/${folder}/${safeId}.${blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
  const uploaded = await client.storage.from('reader-media').upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: '3600' });
  if (uploaded.error) throw uploaded.error;
  return client.storage.from('reader-media').getPublicUrl(path).data.publicUrl;
}

const localReadingData = () => {
  const books = read('ilm-yolida-books', []).filter(item => item && item.id && item.title);
  const bookById = new Map(books.map(book => [String(book.id), book]));
  const entries = [];
  for (const item of read('ilm-yolida-knowledge-notes', [])) {
    const book = bookById.get(String(item.bookId));
    if (!book || !item.text) continue;
    entries.push({
      client_id: String(item.id || `${book.id}-note-${entries.length}`), book_id: book.id,
      kind: item.kind === 'quote' ? 'quote' : item.kind === 'opinion' ? 'opinion' : 'note',
      body: String(item.text).slice(0, 5000), book_title: book.title, book_author: book.author || '',
      page_number: Number(item.pageNumber) > 0 ? Number(item.pageNumber) : null,
      visibility: ['public','group'].includes(item.visibility) ? item.visibility : 'private', group_id: item.groupId || null, created_at: item.createdAt || new Date().toISOString(), updated_at: item.updatedAt || item.createdAt || new Date().toISOString(),
    });
  }
  for (const item of read('ilm-yolida-book-insights', [])) {
    const book = bookById.get(String(item.bookId));
    if (!book) continue;
    if (item.quote) entries.push({
      client_id: `${item.id}:quote`, book_id: book.id, kind: 'quote', body: String(item.quote).slice(0, 5000),
      book_title: book.title, book_author: book.author || '', page_number: Number(item.pageNumber) > 0 ? Number(item.pageNumber) : null,
      visibility: 'private', group_id: null, created_at: item.createdAt || new Date().toISOString(), updated_at: item.updatedAt || item.createdAt || new Date().toISOString(),
    });
    if (item.reflection) entries.push({
      client_id: `${item.id}:opinion`, book_id: book.id, kind: 'opinion', body: String(item.reflection).slice(0, 5000),
      book_title: book.title, book_author: book.author || '', page_number: Number(item.pageNumber) > 0 ? Number(item.pageNumber) : null,
      visibility: 'private', group_id: null, created_at: item.createdAt || new Date().toISOString(), updated_at: item.updatedAt || item.createdAt || new Date().toISOString(),
    });
  }
  return { books, entries };
};

async function syncLocalReadingData(user = currentUser) {
  if (!configured || !user) return { synced: false, reason: configured ? 'signed_out' : 'not_configured' };
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const { books, entries } = localReadingData();
    const byClientId = new Map();
    const existingBooksResult = await client.from('reader_books').select('id,client_id,client_updated_at').eq('user_id', user.id);
    if (existingBooksResult.error) throw existingBooksResult.error;
    const existingBooks = new Map(existingBooksResult.data.map(row => [row.client_id, row]));
    if (books.length) {
      const rows = await Promise.all(books.map(async book => ({
        user_id: user.id, client_id: String(book.id), title: String(book.title).slice(0, 180),
        author: String(book.author || '').slice(0, 140), cover_url: String(book.cover || '').startsWith('data:') ? await uploadImageData(book.cover, 'covers', book.id, user) : String(book.cover || ''),
        total_pages: Math.max(0, Number(book.totalPages) || 0), current_page: Math.max(0, Number(book.currentPage) || 0),
        status: ['planned','reading','finished','paused'].includes(book.status) ? book.status : 'reading',
        description: String(book.description || '').slice(0, 1200), is_public: book.isPublic === true,
        created_at: book.createdAt || new Date().toISOString(),
        client_updated_at: book.updatedAt || book.createdAt || new Date().toISOString(),
      })));
      const changedRows = rows.filter(row => {
        const remote = existingBooks.get(row.client_id);
        return !remote || Date.parse(row.client_updated_at) > Date.parse(remote.client_updated_at || 0);
      });
      if (changedRows.length) {
        const result = await client.from('reader_books').upsert(changedRows, { onConflict: 'user_id,client_id' }).select('id,client_id');
        if (result.error) throw result.error;
        result.data.forEach(row => existingBooks.set(row.client_id, row));
      }
      existingBooks.forEach(row => byClientId.set(row.client_id, row.id));
    }
    if (entries.length) {
      const rows = entries.filter(item => byClientId.has(String(item.book_id))).map(item => ({
        user_id: user.id, book_id: byClientId.get(String(item.book_id)), client_id: item.client_id,
        kind: item.kind, body: item.body, book_title: item.book_title, book_author: item.book_author,
        page_number: item.page_number, visibility: item.visibility, group_id: item.group_id, created_at: item.created_at,
        client_updated_at: item.updated_at || item.created_at || new Date().toISOString(),
      }));
      if (rows.length) {
        const existingResult = await client.from('book_entries').select('client_id,client_updated_at').eq('user_id', user.id);
        if (existingResult.error) throw existingResult.error;
        const known = new Map(existingResult.data.map(row => [row.client_id, row.client_updated_at]));
        const changedRows = rows.filter(row => !known.has(row.client_id) || Date.parse(row.client_updated_at) > Date.parse(known.get(row.client_id) || 0));
        if (changedRows.length) {
          const result = await client.from('book_entries').upsert(changedRows, { onConflict: 'user_id,client_id' });
          if (result.error) throw result.error;
        }
      }
    }
    const sessionRows = [];
    const bookIds = new Map(books.map(book => [String(book.id), book]));
    for (const challenge of read('ilm-yolida-reading-challenges', [])) {
      for (const log of challenge.logs || []) {
        const book = bookIds.get(String(challenge.bookId));
        if (!book || !byClientId.has(String(book.id))) continue;
        sessionRows.push({ user_id: user.id, book_id: byClientId.get(String(book.id)), client_id: `${challenge.id}:${log.day}`,
          pages_read: Math.max(1, Number(log.pages) || 1), reflection: String(log.reflection || '').slice(0, 2000), session_date: log.day });
      }
    }
    if (sessionRows.length) {
      const result = await client.from('reading_sessions').upsert(sessionRows, { onConflict: 'user_id,client_id' });
      if (result.error) throw result.error;
    }
    const cloudBooks = await client.from('reader_books').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (cloudBooks.error) throw cloudBooks.error;
    const localBooksByClientId = new Map(books.map(book => [String(book.id), book]));
    const mergedBooks = cloudBooks.data.map(row => ({
      ...(localBooksByClientId.get(row.client_id) || {}), id: row.client_id, cloudId: row.id,
      title: row.title, author: row.author, cover: localBooksByClientId.get(row.client_id)?.cover || row.cover_url,
      totalPages: row.total_pages, currentPage: row.current_page, status: row.status, description: row.description,
      isPublic: row.is_public, createdAt: row.created_at, updatedAt: row.updated_at,
    }));
    const { error: entriesError, data: cloudEntries } = await client.from('book_entries').select('*, reader_books!inner(client_id)').eq('user_id', user.id).order('created_at', { ascending: false });
    if (entriesError) throw entriesError;
    const cloudEntryIds = new Set(cloudEntries.map(item => item.client_id));
    const currentNotes = read('ilm-yolida-knowledge-notes', []).filter(item => !item.cloudSynced && !cloudEntryIds.has(String(item.id)));
    const syncedNotes = cloudEntries.filter(item => !item.client_id.endsWith(':quote') && !item.client_id.endsWith(':opinion')).map(item => ({
      id: item.client_id, bookId: item.reader_books.client_id, title: item.book_title, text: item.body,
      kind: item.kind, pageNumber: item.page_number, visibility: item.visibility, cloudSynced: true,
      source: `Kitob · ${item.book_title}`, tags: ['kitob'], createdAt: item.created_at,
    }));
    const oldInsights = read('ilm-yolida-book-insights', []), insightParts = new Map();
    for (const item of cloudEntries) {
      const suffix = item.client_id.endsWith(':quote') ? ':quote' : item.client_id.endsWith(':opinion') ? ':opinion' : '';
      if (!suffix) continue;
      const id = item.client_id.slice(0, -suffix.length), value = insightParts.get(id) || { id, bookId: item.reader_books.client_id, createdAt: item.created_at, tags: [], nextReview: new Date().toISOString() };
      value[suffix === ':quote' ? 'quote' : 'reflection'] = item.body;
      insightParts.set(id, value);
    }
    const syncedInsights = [...insightParts.values()].filter(item => item.quote && item.reflection);
    const localInsightIds = new Set(syncedInsights.map(item => item.id));
    write('ilm-yolida-books', mergedBooks);
    write('ilm-yolida-knowledge-notes', [...syncedNotes, ...currentNotes]);
    write('ilm-yolida-book-insights', [...syncedInsights, ...oldInsights.filter(item => !localInsightIds.has(String(item.id)))]);
    localStorage.setItem(`ilm-yolida-cloud-migrated-${user.id}`, 'true');
    return { synced: true, books: mergedBooks.length, entries: cloudEntries.length };
  })().finally(() => { syncInFlight = null; });
  return syncInFlight;
}

async function syncAfterAuth(user) {
  currentUser = user || null;
  window.ilmCloudUser = currentUser;
  window.dispatchEvent(new CustomEvent('ilm-auth-change', { detail: { user: currentUser } }));
  if (!user) return;
  try {
    const result = await syncLocalReadingData(user);
    window.dispatchEvent(new CustomEvent('ilm-cloud-sync', { detail: result }));
  } catch (error) {
    console.error('Ilm Yo‘lida cloud sync:', error);
    window.dispatchEvent(new CustomEvent('ilm-cloud-sync', { detail: { synced: false, error: error.message } }));
  }
}

const cloud = {
  configured,
  client,
  user: () => currentUser,
  signUp: async ({ email, password, name }) => {
    if (!client) throw new Error('Akkaunt sinxroni hali sozlanmagan.');
    const result = await client.auth.signUp({ email, password, options: { data: { display_name: name } } });
    if (result.error) throw result.error;
    if (result.data.session) await syncAfterAuth(result.data.user);
    return { user: result.data.user, needsEmailConfirmation: !result.data.session };
  },
  signIn: async ({ email, password }) => {
    if (!client) throw new Error('Akkaunt sinxroni hali sozlanmagan.');
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    await syncAfterAuth(result.data.user);
    return result.data.user;
  },
  async signInWithGoogle() {
    if (!client) throw new Error('Akkaunt sinxroni hali sozlanmagan.');
    const result = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (result.error) throw result.error;
  },
  signOut: async () => {
    if (client) { const result = await client.auth.signOut(); if (result.error) throw result.error; }
    await syncAfterAuth(null);
  },
  syncLocalReadingData: () => syncLocalReadingData(),
  uploadImage: (dataUrl, folder = 'avatars', id = 'profile') => uploadImageData(dataUrl, folder, id),
  async updateProfile(updates) {
    if (!client || !currentUser) throw new Error('Profilni saqlash uchun akkauntga kiring.');
    const values = { ...updates };
    if (String(values.avatar_url || '').startsWith('data:image/')) values.avatar_url = await uploadImageData(values.avatar_url, 'avatars', 'profile');
    const result = await client.from('profiles').update(values).eq('id', currentUser.id).select('*').single();
    if (result.error) throw result.error;
    return result.data;
  },
  async deleteBook(clientId) {
    if (!client || !currentUser) return;
    const result = await client.from('reader_books').delete().eq('user_id', currentUser.id).eq('client_id', String(clientId));
    if (result.error) throw result.error;
  },
  async createReaderGroup({ name, description = '' }) {
    const user = currentUser; if (!client || !user) throw new Error('Guruh yaratish uchun akkauntga kiring.');
    const inviteCode = `ILM-${crypto.randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase()}`;
    const created = await client.from('reader_groups').insert({ owner_id: user.id, name: String(name).trim(), description: String(description).trim(), invite_code: inviteCode }).select('*').single();
    if (created.error) throw created.error;
    const joined = await client.from('group_members').insert({ group_id: created.data.id, user_id: user.id, role: 'owner' });
    if (joined.error) throw joined.error;
    return created.data;
  },
  async joinReaderGroup(inviteCode) {
    if (!client || !currentUser) throw new Error('Guruhga qo‘shilish uchun akkauntga kiring.');
    const result = await client.rpc('join_reader_group', { invite: String(inviteCode).trim().toUpperCase() });
    if (result.error) throw result.error;
    return result.data;
  },
  async listReaderGroups() {
    if (!client || !currentUser) return [];
    const result = await client.from('group_members').select('role,joined_at,reader_groups(*)').eq('user_id', currentUser.id).order('joined_at', { ascending: false });
    if (result.error) throw result.error;
    return result.data.map(row => ({ ...row.reader_groups, myRole: row.role, joinedAt: row.joined_at }));
  },
  async createReadingChallenge(groupId, input) {
    if (!client || !currentUser) throw new Error('Challenge yaratish uchun akkauntga kiring.');
    const result = await client.from('reading_challenges').insert({ group_id: groupId, created_by: currentUser.id, book_title: input.bookTitle, book_author: input.bookAuthor || '', cover_url: input.coverUrl || '', duration_days: Number(input.durationDays), daily_pages: Number(input.dailyPages), start_date: input.startDate || new Date().toISOString().slice(0, 10), prize: input.prize || '', consequence: input.consequence || '', rules: input.rules || '' }).select('*').single();
    if (result.error) throw result.error;
    return result.data;
  },
  async listChallenges(groupId) {
    if (!client) return [];
    const result = await client.from('reading_challenges').select('*, challenge_progress(*,profiles!challenge_progress_user_id_fkey(display_name,username,avatar_url))').eq('group_id', groupId).order('created_at', { ascending: false });
    if (result.error) throw result.error;
    return result.data;
  },
  async groupMembers(groupId) {
    if (!client) return [];
    const result = await client.from('group_members').select('role,joined_at,user_id,profiles!group_members_user_id_fkey(id,username,display_name,avatar_url)').eq('group_id', groupId).order('joined_at', { ascending: true });
    if (result.error) throw result.error;
    return result.data;
  },
  async submitChallengeProgress(challengeId, input) {
    if (!client || !currentUser) throw new Error('Progress yuborish uchun akkauntga kiring.');
    const readingDate = input.readingDate || new Date().toISOString().slice(0, 10);
    const clientId = String(input.clientId || `${challengeId}:${readingDate}`);
    const result = await client.from('challenge_progress').upsert({ challenge_id: challengeId, user_id: currentUser.id, client_id: clientId, pages_read: Number(input.pagesRead), summary: input.summary || '', proof_shared: input.shareProof === true, reading_date: readingDate }, { onConflict: 'user_id,client_id' }).select('*').single();
    if (result.error) throw result.error;
    if (input.shareProof && input.groupId && input.summary) {
      const proof = `${input.bookTitle ? `📚 ${input.bookTitle} · ` : ''}${Number(input.pagesRead)} sahifa o‘qildi\n\n${input.summary}`;
      const existing = await client.from('group_posts').select('id').eq('progress_id', result.data.id).eq('author_id', currentUser.id).maybeSingle();
      if (existing.error) throw existing.error;
      const post = existing.data
        ? await client.from('group_posts').update({ body: proof }).eq('id', existing.data.id)
        : await client.from('group_posts').insert({ group_id: input.groupId, author_id: currentUser.id, progress_id: result.data.id, body: proof });
      if (post.error) throw post.error;
    } else if (!input.shareProof) {
      const removed = await client.from('group_posts').delete().eq('progress_id', result.data.id).eq('author_id', currentUser.id);
      if (removed.error) throw removed.error;
    }
    return result.data;
  },
  async listGroupMessages(groupId, limit = 100) {
    if (!client) return [];
    const result = await client.from('group_messages').select('id,group_id,author_id,body,created_at,profiles(display_name,username,avatar_url)').eq('group_id', groupId).order('created_at', { ascending: false }).limit(limit);
    if (result.error) throw result.error;
    return result.data.reverse();
  },
  async sendGroupMessage(groupId, body) {
    if (!client || !currentUser) throw new Error('Xabar yuborish uchun akkauntga kiring.');
    const result = await client.from('group_messages').insert({ group_id: groupId, author_id: currentUser.id, body: String(body).trim() }).select('*').single();
    if (result.error) throw result.error;
    return result.data;
  },
  async createGroupPost(groupId, body, progressId = null) {
    if (!client || !currentUser) throw new Error('Guruhga ulashish uchun akkauntga kiring.');
    const result = await client.from('group_posts').insert({ group_id: groupId, author_id: currentUser.id, progress_id: progressId, body: String(body).trim() }).select('*').single();
    if (result.error) throw result.error;
    return result.data;
  },
  async shareBookEntryToGroup(groupId, entry) {
    if (!client || !currentUser) throw new Error('Guruhga ulashish uchun akkauntga kiring.');
    const result = await client.from('group_posts').insert({ group_id: groupId, author_id: currentUser.id, body: `${entry.kind === 'quote' ? 'Iqtibos' : entry.kind === 'opinion' ? 'Fikrim' : 'Qayd'} · ${entry.bookTitle}${entry.pageNumber ? ` · ${entry.pageNumber}-sahifa` : ''}\n\n${entry.body}` }).select('*').single();
    if (result.error) throw result.error;
    return result.data;
  },
  async reactToGroupPost(postId) {
    if (!client || !currentUser) throw new Error('Yoqtirish uchun akkauntga kiring.');
    const existing = await client.from('group_post_reactions').select('user_id').eq('post_id', postId).eq('user_id', currentUser.id).maybeSingle();
    if (existing.error) throw existing.error;
    const result = existing.data
      ? await client.from('group_post_reactions').delete().eq('post_id', postId).eq('user_id', currentUser.id)
      : await client.from('group_post_reactions').insert({ post_id: postId, user_id: currentUser.id });
    if (result.error) throw result.error;
  },
  async commentOnGroupPost(postId, body) {
    if (!client || !currentUser) throw new Error('Izoh qoldirish uchun akkauntga kiring.');
    const result = await client.from('group_post_comments').insert({ post_id: postId, author_id: currentUser.id, body: String(body).trim() }).select('*').single();
    if (result.error) throw result.error;
    return result.data;
  },
  async listGroupPosts(groupId) {
    if (!client) return [];
    const result = await client.from('group_posts').select('*,profiles!group_posts_author_id_fkey(id,username,display_name,avatar_url)').eq('group_id', groupId).order('created_at', { ascending: false }).limit(60);
    if (result.error) throw result.error;
    const ids=result.data.map(post=>post.id);if(!ids.length)return [];
    const [reactions,comments]=await Promise.all([
      client.from('group_post_reactions').select('post_id,user_id').in('post_id',ids),
      client.from('group_post_comments').select('*,profiles!group_post_comments_author_id_fkey(display_name,username,avatar_url)').in('post_id',ids).order('created_at',{ascending:true}),
    ]);
    if(reactions.error)throw reactions.error;if(comments.error)throw comments.error;
    return result.data.map(post=>({...post,reactions:reactions.data.filter(row=>row.post_id===post.id),comments:comments.data.filter(row=>row.post_id===post.id)}));
  },
  subscribeToGroup(groupId, onChange) {
    if (!client) return () => {};
    const channel = client.channel(`reader-group:${groupId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, onChange).on('postgres_changes', { event: '*', schema: 'public', table: 'group_posts', filter: `group_id=eq.${groupId}` }, onChange).on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_progress' }, onChange).subscribe();
    return () => client.removeChannel(channel);
  },
  async publishPost({ kind = 'reflection', body, visibility = 'public' }) {
    if (!client || !currentUser) throw new Error('Post yozish uchun akkauntga kiring.');
    const result = await client.from('community_posts').insert({ author_id: currentUser.id, kind, body: String(body).trim(), visibility }).select('*').single();
    if (result.error) throw result.error;
    return result.data;
  },
  async communityFeed({ authorId, followingOnly = false, limit = 40 } = {}) {
    if (!client || !currentUser) return [];
    let query = client.from('community_posts').select('*,profiles!community_posts_author_id_fkey(id,username,display_name,avatar_url,is_public)').order('created_at', { ascending: false }).limit(limit);
    if (authorId) query = query.eq('author_id', authorId);
    else query = query.eq('visibility', 'public');
    if (followingOnly) {
      const follows = await client.from('follows').select('followed_id').eq('follower_id', currentUser.id);
      if (follows.error) throw follows.error;
      const authorIds = [...new Set([currentUser.id, ...follows.data.map(row => row.followed_id)])];
      query = query.in('author_id', authorIds);
    }
    const result = await query;
    if (result.error) throw result.error;
    const ids = result.data.map(post => post.id);
    if (!ids.length) return [];
    const [reactions, comments] = await Promise.all([
      client.from('post_reactions').select('post_id,user_id,kind').in('post_id', ids),
      client.from('post_comments').select('*,profiles!post_comments_author_id_fkey(display_name,username,avatar_url)').in('post_id', ids).order('created_at', { ascending: true }),
    ]);
    if (reactions.error) throw reactions.error;
    if (comments.error) throw comments.error;
    return result.data.map(post => ({ ...post,
      reactions: reactions.data.filter(item => item.post_id === post.id),
      comments: comments.data.filter(item => item.post_id === post.id),
    }));
  },
  async reactToPost(postId, kind = 'like') {
    if (!client || !currentUser) throw new Error('Yoqtirish uchun akkauntga kiring.');
    const existing = await client.from('post_reactions').select('kind').eq('post_id', postId).eq('user_id', currentUser.id).maybeSingle();
    if (existing.error) throw existing.error;
    const result = existing.data?.kind === kind
      ? await client.from('post_reactions').delete().eq('post_id', postId).eq('user_id', currentUser.id)
      : await client.from('post_reactions').upsert({ post_id: postId, user_id: currentUser.id, kind }, { onConflict: 'post_id,user_id' });
    if (result.error) throw result.error;
  },
  async commentOnPost(postId, body) {
    if (!client || !currentUser) throw new Error('Izoh qoldirish uchun akkauntga kiring.');
    const result = await client.from('post_comments').insert({ post_id: postId, author_id: currentUser.id, body: String(body).trim() }).select('*').single();
    if (result.error) throw result.error;
    return result.data;
  },
  async followProfile(profileId) {
    if (!client || !currentUser) throw new Error('Kuzatish uchun akkauntga kiring.');
    if (profileId === currentUser.id) return;
    const existing = await client.from('follows').select('follower_id').eq('follower_id', currentUser.id).eq('followed_id', profileId).maybeSingle();
    if (existing.error) throw existing.error;
    const result = existing.data
      ? await client.from('follows').delete().eq('follower_id', currentUser.id).eq('followed_id', profileId)
      : await client.from('follows').insert({ follower_id: currentUser.id, followed_id: profileId });
    if (result.error) throw result.error;
    return !existing.data;
  },
  async blockProfile(profileId) {
    if(!client||!currentUser)throw new Error('Bloklash uchun akkauntga kiring.');
    const existing=await client.from('user_blocks').select('blocked_id').eq('blocker_id',currentUser.id).eq('blocked_id',profileId).maybeSingle();
    if(existing.error)throw existing.error;
    const result=existing.data?await client.from('user_blocks').delete().eq('blocker_id',currentUser.id).eq('blocked_id',profileId):await client.from('user_blocks').insert({blocker_id:currentUser.id,blocked_id:profileId});
    if(result.error)throw result.error;return !existing.data;
  },
  async reportUser({userId,postId,reason}) {
    if(!client||!currentUser)throw new Error('Shikoyat yuborish uchun akkauntga kiring.');
    const result=await client.from('user_reports').insert({reporter_id:currentUser.id,reported_user_id:userId||null,post_id:postId||null,reason:String(reason).trim()});
    if(result.error)throw result.error;
  },
  async profile(profileId = currentUser?.id) {
    if (!client || !currentUser || !profileId) return null;
    const result = await client.from('profiles').select('*').eq('id', profileId).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return null;
    const [followers, following, followedByMe] = await Promise.all([
      client.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followed_id', profileId),
      client.from('follows').select('followed_id', { count: 'exact', head: true }).eq('follower_id', profileId),
      client.from('follows').select('followed_id').eq('follower_id', currentUser.id).eq('followed_id', profileId).maybeSingle(),
    ]);
    if (followers.error) throw followers.error;
    if (following.error) throw following.error;
    if (followedByMe.error) throw followedByMe.error;
    return { ...result.data, followerCount: followers.count || 0, followingCount: following.count || 0, followedByMe: Boolean(followedByMe.data) };
  },
  async searchProfiles(term, limit = 20) {
    if (!client || !currentUser) return [];
    const query = String(term || '').trim().replace(/[,%()]/g, '').slice(0, 60);
    if (query.length < 2) return [];
    const [names, usernames] = await Promise.all([
      client.from('profiles').select('id,username,display_name,avatar_url,bio,is_public').eq('is_public', true).ilike('display_name', `%${query}%`).limit(limit),
      client.from('profiles').select('id,username,display_name,avatar_url,bio,is_public').eq('is_public', true).ilike('username', `%${query}%`).limit(limit),
    ]);
    if (names.error) throw names.error;
    if (usernames.error) throw usernames.error;
    return [...new Map([...names.data, ...usernames.data].map(item => [item.id, item])).values()].slice(0, limit);
  },
  async publicBooks(profileId) {
    if (!client || !currentUser) return [];
    let query = client.from('reader_books').select('id,user_id,title,author,cover_url,total_pages,current_page,status,description,created_at').eq('user_id', profileId);
    if (profileId !== currentUser.id) query = query.eq('is_public', true);
    const result = await query.order('updated_at', { ascending: false }).limit(30);
    if (result.error) throw result.error;
    return result.data;
  },
  async notifications(limit = 50) {
    if (!client || !currentUser) return [];
    const result = await client.from('notifications').select('*,profiles!notifications_actor_id_fkey(display_name,username,avatar_url)').eq('recipient_id', currentUser.id).order('created_at', { ascending: false }).limit(limit);
    if (result.error) throw result.error;
    return result.data;
  },
  async markNotificationRead(id) {
    if (!client || !currentUser) return;
    const result = await client.from('notifications').update({ is_read: true }).eq('id', id).eq('recipient_id', currentUser.id);
    if (result.error) throw result.error;
  },
  subscribeToCommunity(onChange) {
    if (!client || !currentUser) return () => {};
    const channel = client.channel(`reader-community:${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, onChange)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${currentUser.id}` }, onChange)
      .subscribe();
    return () => client.removeChannel(channel);
  },
};
window.ilmCloud = cloud;

function showStatus(message, error = false) {
  const node = document.getElementById('ilm-cloud-auth-status');
  if (!node) return;
  node.textContent = message;
  node.classList.toggle('error', error);
}
function authControls() {
  if (!configured) return `<div class="ilm-cloud-account ilm-cloud-unavailable"><span>Onlayn akkaunt hozircha sozlanmagan. Kitoblar ushbu qurilmada saqlanadi.</span></div>`;
  return currentUser
    ? `<div class="ilm-cloud-account"><span><i></i> ${currentUser.email ? currentUser.email.replace(/[&<>"']/g, '') : 'Akkaunt ulandi'}</span><button type="button" onclick="ilmCloudSignOut()">Chiqish</button></div>`
    : `<div class="ilm-cloud-account"><span>Kitoblaringizni qurilmalar orasida sinxronlang</span><button type="button" onclick="openIlmCloudAuth()">Kirish / ro‘yxatdan o‘tish</button></div>`;
}
function authDialog() {
  if (document.getElementById('ilm-cloud-auth-dialog')) return;
  document.body.insertAdjacentHTML('beforeend', `<dialog id="ilm-cloud-auth-dialog" class="ilm-cloud-dialog"><form id="ilm-cloud-auth-form" method="dialog"><button class="ilm-cloud-close" type="button" onclick="document.getElementById('ilm-cloud-auth-dialog').close()" aria-label="Yopish">×</button><span class="ilm-cloud-kicker">ILM YO‘LIDA · SHAXSIY AKKAUNT</span><h2 id="ilm-cloud-auth-title">Akkauntga kirish</h2><p>Kitob javoningiz va yozuvlaringiz hisobingiz bilan birga saqlanadi.</p><label id="ilm-cloud-name-label">Ismingiz<input name="name" autocomplete="name" maxlength="80" placeholder="Ism Familiya"></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Parol<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><small id="ilm-cloud-auth-status" role="status"></small><button class="book-primary" id="ilm-cloud-auth-submit" type="submit">Kirish</button><button class="ilm-cloud-google" id="ilm-cloud-auth-google" type="button">Google bilan davom etish</button><button class="ilm-cloud-switch" id="ilm-cloud-auth-switch" type="button">Akkaunt yaratish</button></form></dialog>`);
  const dialog = document.getElementById('ilm-cloud-auth-dialog'), form = document.getElementById('ilm-cloud-auth-form');
  let mode = 'signin';
  const updateMode = () => {
    document.getElementById('ilm-cloud-auth-title').textContent = mode === 'signin' ? 'Akkauntga kirish' : 'Akkaunt yaratish';
    document.getElementById('ilm-cloud-name-label').hidden = mode === 'signin';
    form.elements.password.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
    document.getElementById('ilm-cloud-auth-submit').textContent = mode === 'signin' ? 'Kirish' : 'Ro‘yxatdan o‘tish';
    document.getElementById('ilm-cloud-auth-switch').textContent = mode === 'signin' ? 'Yangi akkaunt yaratish' : 'Akkauntingiz bormi? Kirish';
    showStatus('');
  };
  document.getElementById('ilm-cloud-auth-switch').addEventListener('click', () => { mode = mode === 'signin' ? 'signup' : 'signin'; updateMode(); });
  document.getElementById('ilm-cloud-auth-google').addEventListener('click', async () => {
    showStatus('Google’ga ulanmoqda…');
    try { await cloud.signInWithGoogle(); }
    catch (error) { showStatus(error.message || 'Google orqali kirib bo‘lmadi.', true); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = document.getElementById('ilm-cloud-auth-submit');
    submit.disabled = true;
    showStatus('Ulanmoqda…');
    try {
      const values = new FormData(form);
      if (mode === 'signin') await cloud.signIn({ email: values.get('email'), password: values.get('password') });
      else {
        const result = await cloud.signUp({ email: values.get('email'), password: values.get('password'), name: values.get('name') });
        if (result.needsEmailConfirmation) { showStatus('Emailingizga tasdiqlash havolasi yuborildi. Tasdiqlagach akkauntga kiring.'); return; }
      }
      dialog.close();
      document.dispatchEvent(new Event('ilm-cloud-redraw'));
    } catch (error) { showStatus(error.message || 'Kirishda xatolik. Qayta urinib ko‘ring.', true); }
    finally { submit.disabled = false; }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
}
window.ilmCloudAccountControls = authControls;
window.openIlmCloudAuth = () => { authDialog(); if (!configured) { showStatus('Supabase URL va public anon key kerak.', true); } document.getElementById('ilm-cloud-auth-dialog').showModal(); };
window.ilmCloudSignOut = async () => { try { await cloud.signOut(); document.dispatchEvent(new Event('ilm-cloud-redraw')); } catch (error) { alert(error.message); } };
window.addEventListener('ilm-auth-change', () => document.dispatchEvent(new Event('ilm-cloud-redraw')));
window.addEventListener('ilm-cloud-sync', event => {
  if (event.detail?.error) {
    const status = document.getElementById('ilm-cloud-sync-status');
    if (status) status.textContent = 'Bulutga sinxronlanmadi. Mahalliy nusxangiz saqlanib qoldi.';
  }
});
function mountAccountControls() {
  const main = document.getElementById('main');
  const header = main?.querySelector('.book-app-head, .community-hero');
  if (!header) return;
  let slot = header.querySelector('.ilm-cloud-account-slot');
  if (!slot) {
    slot = header.querySelector('.ilm-cloud-account');
    if (slot) {
      const wrapper = document.createElement('div');
      wrapper.className = 'ilm-cloud-account-slot';
      slot.replaceWith(wrapper);
      slot = wrapper;
    } else {
      slot = document.createElement('div');
      slot.className = 'ilm-cloud-account-slot';
      header.append(slot);
    }
  }
  const markup = authControls();
  if (slot.innerHTML !== markup) slot.innerHTML = markup;
}
function addCloudStyles() {
  if (document.getElementById('ilm-cloud-styles')) return;
  document.head.insertAdjacentHTML('beforeend', `<style id="ilm-cloud-styles">.ilm-cloud-account-slot{margin-left:auto;align-self:flex-start}.ilm-cloud-account{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #d9e7df;border-radius:12px;background:#fff;color:#36574a;font-size:.74rem}.ilm-cloud-account>span{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ilm-cloud-account>span i{display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:#25a269}.ilm-cloud-account button{border:0;border-radius:8px;padding:7px 10px;background:#176246;color:#fff;font-family:inherit;font-size:.72rem;font-weight:700;cursor:pointer}.ilm-cloud-unavailable{max-width:280px;background:#fff8e8;border-color:#eadcae;color:#80641b}.ilm-cloud-dialog{width:min(94vw,440px);padding:0;border:0;border-radius:22px;box-shadow:0 25px 90px #092a1c55}.ilm-cloud-dialog::backdrop{background:#092a1c99;backdrop-filter:blur(4px)}.ilm-cloud-dialog form{position:relative;display:grid;gap:12px;padding:28px}.ilm-cloud-dialog h2{margin:0;color:#174c3d;font:800 1.5rem Georgia}.ilm-cloud-dialog p{margin:0 0 4px;color:#688075;line-height:1.5}.ilm-cloud-dialog label{display:grid;gap:6px;color:#426659;font-size:.78rem;font-weight:750}.ilm-cloud-dialog input{width:100%;padding:11px 12px;border:1px solid #d8e5dd;border-radius:10px;font:inherit}.ilm-cloud-kicker{color:#b08427;font-size:.67rem;font-weight:900;letter-spacing:.12em}.ilm-cloud-close{position:absolute;right:16px;top:14px;border:0;background:none;color:#60766b;font-size:1.5rem;cursor:pointer}.ilm-cloud-switch{border:0;background:none;color:#176246;font-family:inherit;font-size:.8rem;font-weight:700;cursor:pointer}.ilm-cloud-dialog [role=status]{min-height:1.1em;color:#39705d;font-size:.77rem}.ilm-cloud-dialog [role=status].error{color:#a63131}@media(max-width:650px){.ilm-cloud-account-slot{width:100%;margin:10px 0 0}.ilm-cloud-account{justify-content:space-between}.ilm-cloud-account>span{max-width:56vw}}</style>`);
  document.head.insertAdjacentHTML('beforeend', `<style>.ilm-cloud-google{width:100%;padding:10px;border:1px solid #d4ded8;border-radius:10px;background:#fff;color:#315748;font-family:inherit;font-size:.82rem;font-weight:750;cursor:pointer}.ilm-cloud-google:hover{background:#f3f8f4}</style>`);
}
const observeMain = () => {
  const main = document.getElementById('main');
  if (!main || main.dataset.cloudObserver) return;
  main.dataset.cloudObserver = 'true';
  new MutationObserver(() => mountAccountControls()).observe(main, { childList: true, subtree: true });
  mountAccountControls();
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeMain, { once: true }); else observeMain();
addCloudStyles();
window.addEventListener('ilm-auth-change', () => { mountAccountControls(); if (document.querySelector('.book-app')) { try { render(); } catch {} } });
window.addEventListener('ilm-cloud-sync', () => { mountAccountControls(); if (document.querySelector('.book-app')) { try { render(); } catch {} } });
if (client) {
  client.auth.getSession().then(({ data, error }) => { if (!error) syncAfterAuth(data.session?.user || null); });
  client.auth.onAuthStateChange((_event, session) => { window.setTimeout(() => syncAfterAuth(session?.user || null), 0); });
}
document.addEventListener('ilm-cloud-redraw', () => {
  if (typeof window.booksView === 'function' && document.querySelector('.book-app')) {
    const event = new CustomEvent('ilm-cloud-view-refresh');
    window.dispatchEvent(event);
  }
});
