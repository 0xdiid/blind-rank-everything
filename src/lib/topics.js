export const TOPIC_LABELS = {
  events: "Events",
  ideas: "Ideas",
  culture: "Culture",
  food: "Food",
  nature: "Nature",
  places: "Places",
};

// Only recognized subjects enter the deck. Unclassified articles and biographies
// remain in the source library, rather than filling gaps in a round.
export function topicFor(article) {
  const description = article.description || "";
  // A short description can contain an event's date range; it is not a
  // biographical lead. Only inspect actual excerpts for parenthetical lifespans.
  const lead =
    article.summaryComplete === false
      ? ""
      : article.extract?.slice(0, 450) || "";
  const isPerson =
    /\b(born|actor|actress|politician|singer|songwriter|footballer|rapper|businessman|businesswoman|entrepreneur|journalist|comedian|filmmaker|musician|player|coach|wrestler|boxer|cricketer|golfer|racing driver|billionaire|serial killer|murderer|assassin|physicist|mathematician|philosopher|novelist|poet|historian|engineer|inventor|scientist|explorer|astronaut|monarch|emperor|empress|king of|queen of|president of|prime minister|activist|influencer|youtuber|streamer|pornographic|model and|fashion model|fashion designer|military officer|military leader|royal consort|cardinal|bishop|pope|cleric|religious leader|general|captain|soldier|convicted|criminal|statesman|stateswoman|author|writer|composer|painter|photographer|sculptor|aviator|pioneer|aristocrat|nobleman|countess|duke|earl|prince|princess|president|ruler|director|critic|personality|film star|film-making duo)\b/i.test(
      description,
    ) || /\((?:born\b|b\.\s|\d{4}\s*[–−-]\s*\d{4})/i.test(lead);
  if (isPerson) return null;
  // Explicit topic assignments come from reviewed seed lists, never API guesses.
  if (article.topic && Object.hasOwn(TOPIC_LABELS, article.topic))
    return article.topic;
  const title = article.title || "";
  // A company mentioning technology is not a concept; an aircraft mentioning a
  // war is not an event. Skip these ambiguous candidates unless reviewed above.
  if (
    /\b(company|corporation|conglomerate|organization|organisation|agency|committee|headquarters|military unit|regiment|battalion|executive branch|chief executive|armed forces|aircraft|drone|cruise ship|freighter|trophy|award for|delegation|regulatory body|spoon|utensil)\b/i.test(
      description,
    ) ||
    /^(Individual Neutral Athletes|Athletes) at\b/i.test(title)
  )
    return null;
  if (
    /\b(dish|cuisine|food|bread|cheese|pastry|dessert|beverage|drink|sandwich|soup|noodle|sausage|condiment|chocolate|candy|cake|coffee|tea|wine|beer|cocktail|fermented|culinary|cooking)\b/i.test(
      description,
    )
  )
    return "food";
  if (
    !/\b(multi-sport event|song competition|annual awards)\b/i.test(
      description,
    ) &&
    /\b(film|movie|television series|tv series|sitcom|television program|video game|game franchise|novel|comic|manga|anime|album|song|band|music group|musical genre|music genre|painting|sculpture|board game|card game|sport|fictional|internet meme|animated series|literary|musical instrument|fairy tale)\b/i.test(
      description,
    )
  )
    return "culture";
  if (
    /\b(concept|theory|theorised|theorized|philosophy|philosophical|principle|ideology|belief|religion|economic system|political system|political movement|social movement|psychological|cognitive|ethical|scientific|mathematical|branch of|study of|field of|method|hypothesis|paradox|thought experiment|technology|invention|process|phenomenon|form of government|programming language|communication protocol|specification|artificial intelligence|machine learning|intellectual|art movement|cultural movement)\b/i.test(
      description,
    )
  )
    return "ideas";
  if (
    /\b(war|battle|revolution|rebellion|uprising|coup|election|siege|treaty|earthquake|tsunami|eruption|hurricane|flood|pandemic|epidemic|famine|assassination|massacre|bombing|attack|crash|disaster|protest|scandal|coronation|expedition|festival|holiday|celebration|concert|tournament|championship|olympics|world cup|super bowl|spaceflight|space mission|moon landing|referendum|strike|boycott|declaration|independence movement|multi-sport event|song competition|annual awards|fundraising gala)\b/i.test(
      `${title} ${description}`,
    )
  )
    return "events";
  if (
    /\b(country|city|capital city|town|island|archipelago|continent|mountain|river|lake|landmark|monument|palace|castle|temple|cathedral|national park|archaeological|ancient city|historic site|building|desert|waterfall|forest)\b/i.test(
      description,
    )
  )
    return "places";
  if (
    /\b(species|animal|mammal|bird|reptile|insect|dinosaur|plant|fungus|fossil|celestial|planet|star system|galaxy|nebula|astronomical|natural phenomenon|weather phenomenon|mineral|chemical element|ocean|volcano)\b/i.test(
      description,
    )
  )
    return "nature";
  return null;
}

export function playableArticles(articles) {
  return articles.filter((article) => topicFor(article) !== null);
}

const CONFLICT_TERMS =
  /\b(wars?|warfare|battles?|sieges?|invasions?|military|naval|armed (?:conflicts?|struggles?)|combat|offensives?|insurgenc(?:y|ies)|rebellions?|revolts?|uprisings?|coups?|massacres?|genocides?|pogroms?|bombings?|bombardments?|attacks?|raids?|conquests?|crusades?|blockades?|skirmish(?:es)?|hostilities|peace treat(?:y|ies)|armistices?|ceasefires?)\b/i;

export function isConflictTopic(article) {
  const topic = topicFor(article);
  // Fiction and cultural works with "war" in the title aren't historical conflicts.
  if (topic !== "events" && topic !== "ideas") return false;
  if (CONFLICT_TERMS.test(article.description || "")) return true;
  // "British Invasion" and "Political campaign" are ideas, not military events.
  return topic === "events"
    ? CONFLICT_TERMS.test(article.title || "") ||
        /\b(conflicts?|confrontations?)\b/i.test(article.description || "") ||
        /^(?:Campaign of|Capture of|Storming of)\b/i.test(article.title || "")
    : /\b(wars?|warfare|military|combat)\b/i.test(article.title || "");
}
