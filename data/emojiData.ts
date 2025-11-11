import rawEmojiData from 'emojibase-data/en/data.json';
import groupMetadata from 'emojibase-data/meta/groups.json';

export type EmojiCategoryId =
  | 'smileys_people'
  | 'animals_nature'
  | 'food_drink'
  | 'activities'
  | 'travel_places'
  | 'objects'
  | 'symbols'
  | 'flags';

export interface EmojiDefinition {
  emoji: string;
  name: string;
  keywords: string[];
  category: EmojiCategoryId;
}

type RawEmoji = {
  label: string;
  hexcode: string;
  emoji: string;
  text?: string;
  type: number;
  order?: number;
  group: number;
  subgroup: number;
  version: number;
  tags?: string[];
  skins?: Array<{
    label: string;
    hexcode: string;
    emoji: string;
    text?: string;
    type: number;
    order?: number;
    group?: number;
    subgroup?: number;
    version?: number;
    tone?: number;
  }>;
};

const CATEGORY_CONFIG: Record<EmojiCategoryId, { label: string; icon: string; groups: number[] }> = {
  smileys_people: { label: 'Smileys & People', icon: '😊', groups: [0, 1, 2] },
  animals_nature: { label: 'Animals & Nature', icon: '🌿', groups: [3] },
  food_drink: { label: 'Food & Drink', icon: '🍽️', groups: [4] },
  activities: { label: 'Activities', icon: '⚽', groups: [6] },
  travel_places: { label: 'Travel & Places', icon: '✈️', groups: [5] },
  objects: { label: 'Objects', icon: '🛠️', groups: [7] },
  symbols: { label: 'Symbols', icon: '❤️', groups: [8] },
  flags: { label: 'Flags', icon: '🏳️', groups: [9] },
};

const CATEGORY_BY_GROUP = Object.entries(CATEGORY_CONFIG).reduce<Record<number, EmojiCategoryId>>((acc, [id, config]) => {
  for (const groupId of config.groups) {
    acc[groupId] = id as EmojiCategoryId;
  }
  return acc;
}, {});

const titleCase = (value: string) => {
  return value
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const [first, ...rest] = word;
      return first.toUpperCase() + rest.join('');
    })
    .join(' ')
    .replace(/\s+-\s+/g, ' – ')
    .replace(/:/g, ' –');
};

const collectKeywords = (label: string, tags: string[] | undefined): string[] => {
  const keywords = new Set<string>();
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (tag) {
        keywords.add(tag.toLowerCase());
      }
    }
  }

  const normalizedLabel = label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ');

  for (const part of normalizedLabel.split(/\s+/)) {
    if (part) {
      keywords.add(part);
    }
  }

  return Array.from(keywords);
};

interface EmojiWithOrder {
  definition: EmojiDefinition;
  order: number;
}

const rawEmojis = rawEmojiData as RawEmoji[];

const emojiDefinitionsWithOrder: EmojiWithOrder[] = [];
const emojiMetadata = new Map<string, { group: number; subgroup: number; order: number }>();

const addDefinition = (
  emoji: string | undefined,
  label: string,
  tags: string[] | undefined,
  group: number,
  subgroup: number,
  order: number | undefined
) => {
  if (!emoji) {
    return;
  }

  const categoryId = CATEGORY_BY_GROUP[group];
  if (!categoryId) {
    return;
  }

  const formattedLabel = titleCase(label);
  const resolvedOrder = typeof order === 'number' ? order : Number.POSITIVE_INFINITY;
  emojiMetadata.set(emoji, { group, subgroup, order: resolvedOrder });
  emojiDefinitionsWithOrder.push({
    definition: {
      emoji,
      name: formattedLabel,
      keywords: collectKeywords(label, tags),
      category: categoryId,
    },
    order: resolvedOrder,
  });
};

for (const entry of rawEmojis) {
  addDefinition(entry.emoji, entry.label, entry.tags, entry.group, entry.subgroup, entry.order);
  if (Array.isArray(entry.skins)) {
    for (const skin of entry.skins) {
      addDefinition(
        skin.emoji,
        skin.label,
        entry.tags,
        skin.group ?? entry.group,
        skin.subgroup ?? entry.subgroup,
        skin.order ?? entry.order
      );
    }
  }
}

emojiDefinitionsWithOrder.sort((a, b) => {
  if (a.order !== b.order) {
    return a.order - b.order;
  }
  return a.definition.name.localeCompare(b.definition.name);
});

export const EMOJI_DEFINITIONS: EmojiDefinition[] = emojiDefinitionsWithOrder.map(({ definition }) => definition);

export const EMOJI_CATEGORIES = (Object.keys(CATEGORY_CONFIG) as EmojiCategoryId[]).map((id) => ({
  id,
  label: CATEGORY_CONFIG[id].label,
  icon: CATEGORY_CONFIG[id].icon,
}));

export const EMOJI_BY_CATEGORY: Record<EmojiCategoryId, EmojiDefinition[]> = EMOJI_CATEGORIES.reduce(
  (accumulator, category) => {
    accumulator[category.id] = EMOJI_DEFINITIONS.filter((emoji) => emoji.category === category.id);
    return accumulator;
  },
  {} as Record<EmojiCategoryId, EmojiDefinition[]>
);

const HIERARCHY = (groupMetadata as { hierarchy: Record<string, number[]> }).hierarchy;

for (const category of EMOJI_CATEGORIES) {
  const groups = CATEGORY_CONFIG[category.id].groups;
  const subgroupIndices = groups.flatMap((groupId) => HIERARCHY[String(groupId)] ?? []);
  const subgroupOrder = new Map<number, number>();
  subgroupIndices.forEach((subgroupId, index) => subgroupOrder.set(subgroupId, index));

  EMOJI_BY_CATEGORY[category.id].sort((a, b) => {
    const aMeta = emojiMetadata.get(a.emoji);
    const bMeta = emojiMetadata.get(b.emoji);
    const aGroup = aMeta?.group ?? 0;
    const bGroup = bMeta?.group ?? 0;
    if (aGroup !== bGroup) {
      return aGroup - bGroup;
    }

    const aSubgroup = aMeta?.subgroup ?? 0;
    const bSubgroup = bMeta?.subgroup ?? 0;
    if (aSubgroup !== bSubgroup) {
      const orderA = subgroupOrder.get(aSubgroup) ?? aSubgroup;
      const orderB = subgroupOrder.get(bSubgroup) ?? bSubgroup;
      return orderA - orderB;
    }

    const aOrder = aMeta?.order ?? Number.POSITIVE_INFINITY;
    const bOrder = bMeta?.order ?? Number.POSITIVE_INFINITY;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return a.name.localeCompare(b.name);
  });
}
