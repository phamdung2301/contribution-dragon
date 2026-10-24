import { Calendar, Day, levelOf } from "./theme.js";

interface GraphQLDay { date: string; contributionCount: number }
interface GraphQLWeek { contributionDays: GraphQLDay[] }
interface GraphQLResponse {
  data?: {
    user?: { contributionsCollection?: { contributionCalendar?: { weeks: GraphQLWeek[] } } };
  };
  errors?: { message: string }[];
}

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays { date contributionCount }
        }
      }
    }
  }
}`;

export async function fetchCalendar(token: string, user: string): Promise<Calendar> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "contribution-dragon",
    },
    body: JSON.stringify({ query: QUERY, variables: { login: user } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as GraphQLResponse;
  if (json.errors?.length) throw new Error("GraphQL errors: " + json.errors.map(e => e.message).join("; "));
  const weeks = json.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks) throw new Error("No contributionCalendar in response — check the token scope (read:user).");
  return {
    weeks: weeks.map(w =>
      w.contributionDays.map(
        (d: GraphQLDay): Day => ({ date: d.date, count: d.contributionCount, level: levelOf(d.contributionCount) })
      )
    ),
  };
}

/** Deterministic pseudo-random fixture (seeded LCG) — for demos and tests, no token needed. */
export function fixtureCalendar(seed = 20260101): Calendar {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const weeks: Day[][] = [];
  const start = new Date(Date.UTC(2025, 0, 5)); // một chủ nhật
  for (let w = 0; w < 52; w++) {
    const days: Day[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + w * 7 + d);
      // mùa "bận rộn" đầu năm + cuối năm, nghỉ giữa năm
      const season = 0.55 + 0.45 * Math.sin((w / 52) * Math.PI * 2 - 1.2);
      const roll = rnd();
      const count = roll < 0.28 ? 0 : Math.round(roll * 14 * season);
      days.push({
        date: date.toISOString().slice(0, 10),
        count,
        level: levelOf(count),
      });
    }
    weeks.push(days);
  }
  return { weeks };
}
