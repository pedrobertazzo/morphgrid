export type Illustration = 'city' | 'sea' | 'phantom' | 'bag' | 'sentinels';

export interface Passage {
  id: string;
  chapter: number;
  chapterTitle: string;
  para: number;
  text: string;
  pull: string;
  gloss: string;
  characters: string[];
  places: string[];
  themes: string[];
  image?: { kind: Illustration; caption: string; alt: string };
}

export const PASSAGES: Passage[] = [
  {
    id: 'ishmael',
    chapter: 1,
    chapterTitle: 'Loomings',
    para: 1,
    text:
      'Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation.',
    pull: 'Call me Ishmael.',
    gloss: 'The narrator introduces himself and his cure for low spirits: going to sea.',
    characters: ['Ishmael'],
    places: ['The sea'],
    themes: ['Restlessness', 'Escape'],
    image: { kind: 'sea', caption: 'The watery part of the world.', alt: 'A low sun on the horizon over rolling waves, with a small ship.' },
  },
  {
    id: 'manhattoes',
    chapter: 1,
    chapterTitle: 'Loomings',
    para: 2,
    text:
      'There now is your insular city of the Manhattoes, belted round by wharves as Indian isles by coral reefs—commerce surrounds it with her surf. Right and left, the streets take you waterward. Its extreme downtown is the battery, where that noble mole is washed by waves, and cooled by breezes, which a few hours previous were out of sight of land.',
    pull: 'Right and left, the streets take you waterward.',
    gloss: 'Manhattan, ringed by wharves, where every street leads to the water.',
    characters: [],
    places: ['Manhattan', 'The Battery'],
    themes: ['Commerce', 'The pull of water'],
    image: { kind: 'city', caption: 'The insular city of the Manhattoes, belted round by wharves.', alt: 'A city skyline behind a row of wharves and tall-masted ships.' },
  },
  {
    id: 'sentinels',
    chapter: 1,
    chapterTitle: 'Loomings',
    para: 3,
    text:
      'Circumambulate the city of a dreamy Sabbath afternoon. Go from Corlears Hook to Coenties Slip, and from thence, by Whitehall, northward. What do you see?—Posted like silent sentinels all around the town, stand thousands upon thousands of mortal men fixed in ocean reveries.',
    pull: 'Thousands upon thousands of mortal men fixed in ocean reveries.',
    gloss: 'On Sundays, crowds of city workers stand at the shore staring out to sea.',
    characters: ['City crowds'],
    places: ["Corlears Hook", 'Coenties Slip', 'Whitehall'],
    themes: ['Longing', 'Everyday people'],
    image: { kind: 'sentinels', caption: 'Posted like silent sentinels all around the town.', alt: 'A row of standing figures on a pier, looking out at the water.' },
  },
  {
    id: 'wedded',
    chapter: 1,
    chapterTitle: 'Loomings',
    para: 4,
    text: 'Yes, as every one knows, meditation and water are wedded for ever.',
    pull: 'Meditation and water are wedded for ever.',
    gloss: 'The chapter’s thesis in a single line.',
    characters: [],
    places: [],
    themes: ['Contemplation'],
  },
  {
    id: 'vibration',
    chapter: 1,
    chapterTitle: 'Loomings',
    para: 5,
    text:
      'Why upon your first voyage as a passenger, did you yourself feel such a mystical vibration, when first told that you and your ship were now out of sight of land?',
    pull: 'Such a mystical vibration.',
    gloss: 'A question to the reader: why does losing sight of land feel sacred?',
    characters: ['The reader'],
    places: ['Open sea'],
    themes: ['The sublime', 'First voyages'],
  },
  {
    id: 'phantom',
    chapter: 1,
    chapterTitle: 'Loomings',
    para: 6,
    text:
      'By reason of these things, then, the whaling voyage was welcome; the great flood-gates of the wonder-world swung open, and in the wild conceits that swayed me to my purpose, two and two there floated into my inmost soul, endless processions of the whale, and, mid most of them all, one grand hooded phantom, like a snow hill in the air.',
    pull: 'One grand hooded phantom, like a snow hill in the air.',
    gloss: 'The first shadow of the white whale, seen only in imagination.',
    characters: ['Ishmael', 'The whale'],
    places: ['The wonder-world'],
    themes: ['Foreshadowing', 'Obsession'],
    image: { kind: 'phantom', caption: 'One grand hooded phantom, like a snow hill in the air.', alt: 'A pale whale rising out of dark hatched waves under a stormy sky.' },
  },
  {
    id: 'carpetbag',
    chapter: 2,
    chapterTitle: 'The Carpet-Bag',
    para: 1,
    text:
      'I stuffed a shirt or two into my old carpet-bag, tucked it under my arm, and started for Cape Horn and the Pacific.',
    pull: 'Started for Cape Horn and the Pacific.',
    gloss: 'Ishmael packs light and sets off.',
    characters: ['Ishmael'],
    places: ['New York', 'Cape Horn', 'The Pacific'],
    themes: ['Departure'],
    image: { kind: 'bag', caption: 'My old carpet-bag.', alt: 'A patterned carpet-bag with a wooden handle.' },
  },
];

export const words = (p: Passage) => p.text.split(/\s+/).filter(Boolean).length;
export const loc = (p: Passage) => `Ch. ${p.chapter} ¶${p.para}`;
