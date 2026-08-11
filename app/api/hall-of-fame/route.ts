import { getHallTier, normalizeHallAttempts, type HallOfFameRecord } from "../../hall-of-fame";

const PADLET_API_BASE = "https://api.padlet.dev/v1";
const MAX_NAME_LENGTH = 30;
const MAX_COMMENT_LENGTH = 200;

type HallOfFameRequest = {
  nickname?: unknown;
  name?: unknown;
  attempts?: unknown;
  comment?: unknown;
};

type PadletError = {
  errors?: Array<{ detail?: string; title?: string; code?: string }>;
};

type PadletPost = {
  id?: string;
  type?: string;
  attributes?: {
    content?: { subject?: string; bodyHtml?: string; body?: string };
    createdAt?: string;
    status?: string;
    webUrl?: { live?: string };
  };
  relationships?: {
    section?: { data?: { id?: string } | null };
  };
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function htmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function nicknameFromSubject(subject: string) {
  return cleanText(subject.replace(/^🏆\s*/u, "").split(" · ")[0], MAX_NAME_LENGTH) || "이름 없는 대원";
}

function parsePost(post: PadletPost): Omit<HallOfFameRecord, "rank"> | null {
  const content = post.attributes?.content;
  const body = htmlToText(content?.bodyHtml ?? content?.body ?? "");
  const attemptsMatch = body.match(/도전 횟수:\s*(\d+)회?/u) ?? body.match(/총\s*(\d+)회/u);
  const rawAttempts = attemptsMatch ? Number(attemptsMatch[1]) : Number.NaN;
  if (!post.id || !Number.isInteger(rawAttempts) || rawAttempts < 1 || rawAttempts > 9999) return null;
  const attempts = normalizeHallAttempts(rawAttempts);

  const commentMatch = body.match(/클리어 소감:\s*(.+?)(?:\n|$)/u);
  return {
    id: post.id,
    nickname: nicknameFromSubject(content?.subject ?? ""),
    attempts,
    comment: cleanText(commentMatch?.[1] ?? "기록에 소감을 남기지 않았습니다.", MAX_COMMENT_LENGTH),
    tier: getHallTier(attempts),
    createdAt: post.attributes?.createdAt ?? "",
    url: post.attributes?.webUrl?.live ?? null,
  };
}

function credentials() {
  return {
    apiKey: process.env.PADLET_API_KEY?.trim(),
    boardId: process.env.PADLET_BOARD_ID?.trim(),
    sectionId: process.env.PADLET_SECTION_ID?.trim(),
  };
}

export async function GET() {
  const { apiKey, boardId, sectionId } = credentials();
  if (!apiKey || !boardId) {
    return json({ error: "명예의 전당 연결이 아직 설정되지 않았습니다." }, 503);
  }

  let response: Response;
  try {
    response = await fetch(`${PADLET_API_BASE}/boards/${encodeURIComponent(boardId)}?include=posts`, {
      headers: {
        accept: "application/vnd.api+json",
        "x-api-key": apiKey,
      },
      cache: "no-store",
    });
  } catch {
    return json({ error: "Padlet 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, 502);
  }

  const payload = await response.json().catch(() => null) as (PadletError & { included?: PadletPost[] }) | null;
  if (!response.ok) {
    const padletError = payload?.errors?.[0];
    console.error("Padlet hall-of-fame fetch failed", {
      status: response.status,
      code: padletError?.code,
      detail: padletError?.detail ?? padletError?.title,
    });
    return json({ error: "Padlet 기록을 불러오지 못했습니다. 연결 설정을 확인해 주세요." }, 502);
  }

  const records = (payload?.included ?? [])
    .filter((post) => post.type === "post")
    .filter((post) => !sectionId || post.relationships?.section?.data?.id === sectionId)
    .filter((post) => !post.attributes?.status || post.attributes.status === "approved")
    .map(parsePost)
    .filter((record): record is Omit<HallOfFameRecord, "rank"> => record !== null)
    .sort((left, right) => left.attempts - right.attempts || left.createdAt.localeCompare(right.createdAt))
    .slice(0, 50)
    .map((record, index): HallOfFameRecord => ({ ...record, rank: index + 1 }));

  return json({ records });
}

export async function POST(request: Request) {
  const { apiKey, boardId, sectionId } = credentials();
  if (!apiKey || !boardId) {
    return json({ error: "명예의 전당 연결이 아직 설정되지 않았습니다." }, 503);
  }

  let input: HallOfFameRequest;
  try {
    input = await request.json() as HallOfFameRequest;
  } catch {
    return json({ error: "올바른 기록 정보를 보내 주세요." }, 400);
  }

  const nickname = cleanText(input.nickname ?? input.name, MAX_NAME_LENGTH);
  const comment = cleanText(input.comment, MAX_COMMENT_LENGTH);
  const rawAttempts = typeof input.attempts === "number" ? input.attempts : Number.NaN;
  if (!nickname || !comment || !Number.isInteger(rawAttempts) || rawAttempts < 1 || rawAttempts > 9999) {
    return json({ error: "닉네임, 도전 기록, 클리어 소감을 확인해 주세요." }, 400);
  }

  const attempts = normalizeHallAttempts(rawAttempts);
  const tier = getHallTier(attempts);
  const data: Record<string, unknown> = {
    type: "post",
    attributes: {
      content: {
        subject: `🏆 ${nickname} · ${tier.title}`,
        body: [
          "FACTOR FORCE 명예의 전당",
          `도전 횟수: ${attempts}회`,
          `칭호: ${tier.title}`,
          `등급: ${tier.level}단계`,
          `클리어 소감: ${comment}`,
        ].join("\n"),
      },
      color: "blue",
    },
  };

  if (sectionId) {
    data.relationships = {
      section: { data: { type: "section", id: sectionId } },
    };
  }

  let response: Response;
  try {
    response = await fetch(`${PADLET_API_BASE}/boards/${encodeURIComponent(boardId)}/posts`, {
      method: "POST",
      headers: {
        accept: "application/vnd.api+json",
        "content-type": "application/vnd.api+json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ data }),
    });
  } catch {
    return json({ error: "Padlet에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 502);
  }

  const payload = await response.json().catch(() => null) as (PadletError & {
    data?: { id?: string; attributes?: { webUrl?: { live?: string } } };
  }) | null;

  if (!response.ok) {
    const padletError = payload?.errors?.[0];
    console.error("Padlet hall-of-fame upload failed", {
      status: response.status,
      code: padletError?.code,
      detail: padletError?.detail ?? padletError?.title,
    });
    return json({ error: "기록을 올리지 못했습니다. 잠시 후 다시 시도해 주세요." }, 502);
  }

  return json({
    ok: true,
    postId: payload?.data?.id ?? null,
    url: payload?.data?.attributes?.webUrl?.live ?? null,
    tier,
  }, 201);
}
