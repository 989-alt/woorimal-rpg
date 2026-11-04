// 저장소: 닉네임별 localStorage 저장. storage는 주입한다.
const SAVE = 'malbit:save:';
const NAMES = 'malbit:names';
const PROBE = 'malbit:probe';

const SHAPE = {
  version: 'number', nickname: 'string', avatar: 'any', act: 'number', chapter: 'number',
  pos: 'object', facing: 'string', acquired: 'object', quests: 'object', bag: 'array',
  hiddenFound: 'object', smallGone: 'object', askedWordIds: 'array',
  clearedChapters: 'array', clearedActs: 'array', seenTips: 'array',
};

function typeOk(v, t) {
  if (t === 'any') return v !== undefined;
  if (t === 'array') return Array.isArray(v);
  if (t === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v);
  return typeof v === t;
}

function valid(s) {
  if (!typeOk(s, 'object') || s.version !== 1) return false;
  return Object.entries(SHAPE).every(([k, t]) => typeOk(s[k], t));
}

export function createStore(storage) {
  let available = false;
  if (storage) {
    try {
      storage.setItem(PROBE, '1');
      storage.removeItem(PROBE);
      available = true;
    } catch { available = false; }
  }

  function names() {
    if (!storage) return [];
    try {
      const a = JSON.parse(storage.getItem(NAMES));
      return Array.isArray(a) ? a.filter((n) => typeof n === 'string') : [];
    } catch { return []; }
  }

  function readRaw(nickname) {
    if (!storage) return null;
    try { return storage.getItem(SAVE + nickname); } catch { return null; }
  }

  return {
    get available() { return available; },
    names,
    load(nickname) {
      const raw = readRaw(nickname);
      if (raw === null || raw === undefined) return { ok: false, reason: 'missing' };
      try {
        const state = JSON.parse(raw);
        if (valid(state)) return { ok: true, state };
      } catch { /* fall through */ }
      return { ok: false, reason: 'corrupt' };
    },
    save(state) {
      if (!storage || !available) return false;
      try {
        storage.setItem(SAVE + state.nickname, JSON.stringify(state));
        const list = names();
        if (!list.includes(state.nickname)) {
          list.push(state.nickname);
          storage.setItem(NAMES, JSON.stringify(list));
        }
        return true;
      } catch {
        available = false;
        return false;
      }
    },
    has(nickname) { return readRaw(nickname) !== null; },
  };
}
