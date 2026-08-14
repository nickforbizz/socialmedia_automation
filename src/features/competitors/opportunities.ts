/**
 * Content-gap / opportunity analysis. Compares themes competitors are getting
 * engagement on against (a) footage the user already has and (b) what the user
 * has already posted. The goal is original inspiration grounded in the user's
 * own library — never copying. Pure and unit-tested.
 */

export interface CompetitorTopic {
  topic: string;
  count: number;
  avgEngagement: number;
}

export type OpportunityType = "untapped_footage" | "content_gap" | "covered";

export interface Opportunity {
  topic: string;
  type: OpportunityType;
  competitorCount: number;
  competitorAvgEngagement: number;
  rationale: string;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * @param competitorTopics topics competitors post, with volume + engagement
 * @param userMediaTopics  topics/keywords the user HAS footage for
 * @param userPostedTopics topics the user has already published
 */
export function findOpportunities(
  competitorTopics: CompetitorTopic[],
  userMediaTopics: Iterable<string>,
  userPostedTopics: Iterable<string>,
  limit = 6,
): Opportunity[] {
  const have = new Set([...userMediaTopics].map(norm));
  const posted = new Set([...userPostedTopics].map(norm));

  const ranked = [...competitorTopics].sort(
    (a, b) => b.avgEngagement - a.avgEngagement || b.count - a.count,
  );

  const opportunities: Opportunity[] = ranked.map((t) => {
    const key = norm(t.topic);
    let type: OpportunityType;
    let rationale: string;
    if (have.has(key) && !posted.has(key)) {
      type = "untapped_footage";
      rationale = `Competitors get strong engagement on ${t.topic}, and you already have ${t.topic} footage you haven't posted. Publish your own take.`;
    } else if (!have.has(key)) {
      type = "content_gap";
      rationale = `${t.topic} performs for competitors but isn't in your library yet — a gap worth capturing, or approach it from an angle you can shoot.`;
    } else {
      type = "covered";
      rationale = `You already cover ${t.topic}; keep a steady cadence to stay competitive.`;
    }
    return {
      topic: t.topic,
      type,
      competitorCount: t.count,
      competitorAvgEngagement: t.avgEngagement,
      rationale,
    };
  });

  // Prioritize untapped footage, then gaps, then covered.
  const priority: Record<OpportunityType, number> = {
    untapped_footage: 0,
    content_gap: 1,
    covered: 2,
  };
  return opportunities
    .sort((a, b) => priority[a.type] - priority[b.type])
    .slice(0, limit);
}
