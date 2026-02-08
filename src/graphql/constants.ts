import queryIds from './query-ids.json';

export const TWITTER_API_BASE = 'https://x.com/i/api/graphql';

export const FALLBACK_QUERY_IDS: Record<string, string> = {
  CreateTweet: 'TAJw1rBsjAtdNgTdlo2oeg',
  CreateRetweet: 'ojPdsZsimiJrUGLR1sjUtA',
  DeleteRetweet: 'iQtK4dl5hBmXewYZuEOKVw',
  CreateFriendship: '8h9JVdV8dlSyqyRDJEPCsA',
  DestroyFriendship: 'ppXWuagMNXgvzx6WoXBW0Q',
  FavoriteTweet: 'lI07N6Otwv1PhnEgXILM7A',
  UnfavoriteTweet: 'ZYKSe-w7KEslx3JhSIk5LA',
  CreateBookmark: 'aoDbu3RHznuiSkQ9aNM67Q',
  DeleteBookmark: 'Wlmlj2-xzyS1GN3a6cj-mQ',
  TweetDetail: '97JF30KziU00483E_8elBA',
  SearchTimeline: 'M1jEez78PEfVfbQLvlWMvQ',
  UserTweets: 'Wms1GvIiHXAPBaCr9KblaA',
  Bookmarks: 'RV1g3b8n_SGOHwkqKYSCFw',
  Following: 'BEkNpEt5pNETESoqMsTEGA',
  Followers: 'kuFUYP9eV1FPoEy4N-pi7w',
  Likes: 'JR2gceKucIKcVNB_9JkhsA',
  HomeTimeline: 'edseUwk9sP5Phz__9TIRnA',
  HomeLatestTimeline: 'iOEZpOdfekFsxSlPQCQtPg',
  AboutAccountQuery: 'zs_jFPFT78rBpXv9Z3U2YQ',
};

export const QUERY_IDS: Record<string, string> = {
  ...FALLBACK_QUERY_IDS,
  ...(queryIds as Record<string, string>),
};

export const TARGET_QUERY_ID_OPERATIONS = Object.keys(FALLBACK_QUERY_IDS);

export const SETTINGS_SCREEN_NAME_REGEX = /"screen_name":"([^"]+)"/;
export const SETTINGS_USER_ID_REGEX = /"user_id"\s*:\s*"(\d+)"/;
export const SETTINGS_NAME_REGEX = /"name":"([^"\\]*(?:\\.[^"\\]*)*)"/;

export const TWEET_URL_REGEX = /(?:twitter\.com|x\.com)\/(?:\w+\/status|i\/web\/status)\/(\d+)/i;

export function extractTweetId(input: string): string {
  const urlMatch = TWEET_URL_REGEX.exec(input);
  if (urlMatch) return urlMatch[1];
  return input;
}

export function normalizeHandle(input?: string): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  const withoutAt = raw.startsWith('@') ? raw.slice(1) : raw;
  const handle = withoutAt.trim();
  if (!handle || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  return handle;
}
