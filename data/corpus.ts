// Test datasets from unrelated domains. None of them has domain-specific code in the pipeline.

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 28);
const r2 = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// Shaped like Steam's GetOwnedGames response; numbers from My Gaming Grid's sample profile.
const GAMES: [number, string, number, number, number, [number, number] | null][] = [
  [1086940, "Baldur's Gate 3", 18420, 0, 40, [38, 54]],
  [1145360, 'Hades', 9120, 0, 210, [49, 49]],
  [413150, 'Stardew Valley', 8340, 620, 2, [31, 40]],
  [2379780, 'Balatro', 5210, 1180, 1, [22, 30]],
  [367520, 'Hollow Knight', 4380, 0, 400, [40, 63]],
  [1245620, 'ELDEN RING', 7940, 0, 120, [35, 42]],
  [646570, 'Slay the Spire', 6620, 0, 300, [26, 46]],
  [427520, 'Factorio', 5980, 300, 5, [12, 38]],
  [105600, 'Terraria', 3100, 0, 900, [41, 115]],
  [620, 'Portal 2', 1260, 0, 1500, [51, 51]],
  [753640, 'Outer Wilds', 1180, 0, 700, [27, 31]],
  [632470, 'Disco Elysium', 2240, 0, 800, [29, 45]],
  [504230, 'Celeste', 1840, 0, 1100, [20, 32]],
  [588650, 'Dead Cells', 1520, 0, 1300, [19, 122]],
  [1794680, 'Vampire Survivors', 1980, 0, 600, [140, 239]],
  [1092790, 'Inscryption', 870, 0, 950, [14, 20]],
  [292030, 'The Witcher 3: Wild Hunt', 3960, 0, 2100, [41, 78]],
  [1091500, 'Cyberpunk 2077', 2810, 0, 500, [24, 57]],
  [220, 'Half-Life 2', 760, 0, 2600, [21, 33]],
  [252950, 'Rocket League', 420, 0, 1900, null],
  [578080, 'PUBG: BATTLEGROUNDS', 35, 0, 2300, null],
  [440, 'Team Fortress 2', 0, 0, 0, null],
  [570, 'Dota 2', 0, 0, 0, null],
  [1174180, 'Red Dead Redemption 2', 0, 0, 0, null],
  [1145350, 'Hades II', 0, 0, 0, null],
  [990080, 'Hogwarts Legacy', 12, 0, 1000, null],
  [264710, 'Subnautica', 0, 0, 0, null],
  [945360, 'Among Us', 0, 0, 0, null],
];

export const steam = {
  response: {
    game_count: GAMES.length,
    games: GAMES.map(([appid, name, min, recent, daysAgo, ach], i) => {
      const deck = i % 3 === 0 ? Math.round(min * 0.4) : 0;
      return {
        appid,
        name,
        playtime_forever: min,
        playtime_2weeks: recent || undefined,
        playtime_windows_forever: min - deck,
        playtime_deck_forever: deck,
        rtime_last_played: min ? Math.floor((NOW - daysAgo * DAY) / 1000) : 0,
        img_header: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
        achievements: ach ? { earned: ach[0], total: ach[1] } : null,
      };
    }),
  },
};

const DEVICES = [
  { id: 'greenhouse-a', lat: 59.33, lng: 18.06, base: 24 },
  { id: 'greenhouse-b', lat: 59.35, lng: 18.1, base: 22 },
  { id: 'warehouse', lat: 59.31, lng: 18.0, base: 14 },
  { id: 'rooftop', lat: 59.34, lng: 18.03, base: 9 },
];

export const iot = (() => {
  const r = rng(7);
  const out = [];
  for (let h = 0; h < 72; h++)
    for (const d of DEVICES) {
      const t = NOW - (72 - h) * 3600000;
      const day = Math.sin(((h % 24) - 8) / 24 * 2 * Math.PI);
      out.push({
        measurement_time: new Date(t).toISOString(),
        device: d.id,
        temperature: r2(d.base + day * 4 + (r() - 0.5) * 1.5),
        pressure: Math.round(1012 - h * 0.15 + (r() - 0.5) * 3),
        battery_pct: Math.max(5, Math.round(100 - h * 0.6 - DEVICES.indexOf(d) * 8)),
        location: { lat: d.lat, lng: d.lng },
      });
    }
  return out;
})();

const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
const PRODUCTS = ['Desk', 'Chair', 'Lamp', 'Monitor', 'Keyboard', 'Mouse', 'Headset', 'Webcam', 'Dock', 'Cable', 'Stand', 'Mat'];
const PRICES = [420, 180, 45, 260, 90, 35, 110, 70, 150, 12, 55, 20];

export const sales = (() => {
  const r = rng(11);
  return Array.from({ length: 640 }, (_, i) => {
    const t = new Date(NOW - Math.floor(r() * 700) * DAY);
    const p = Math.floor(r() ** 1.6 * PRODUCTS.length);
    const region = REGIONS[Math.floor(r() ** 0.8 * REGIONS.length)];
    const units = 1 + Math.floor(r() * 8);
    const discount = Math.round(r() * 20);
    return {
      order_id: `SO-${10000 + i}`,
      order_date: `${String(t.getUTCDate()).padStart(2, '0')}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${t.getUTCFullYear()}`,
      region,
      product: PRODUCTS[p],
      units,
      revenue: Math.round(units * PRICES[p] * (1 - discount / 100)),
      discount_pct: discount,
    };
  });
})();

const FIRST = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida', 'Joe', 'Kim', 'Lou', 'Max', 'Nia', 'Oto', 'Pia'];
const LAST = ['Lind', 'Berg', 'Holm', 'Strand', 'Dahl', 'Ek', 'Sjö', 'Nord'];
const DEPTS: [string, number][] = [['Engineering', 72000], ['Design', 61000], ['Sales', 54000], ['Support', 43000], ['Finance', 66000], ['People', 51000]];

export const employees = (() => {
  const r = rng(5);
  return Array.from({ length: 120 }, (_, i) => {
    const [dept, base] = DEPTS[Math.floor(r() * DEPTS.length)];
    const tenure = r2(r() * 12);
    return {
      employee_id: `E${1000 + i}`,
      name: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`,
      department: dept,
      salary: Math.round(base + tenure * 2400 + (r() - 0.5) * 9000),
      tenure_years: tenure,
      performance_rating: r2(2.5 + r() * 2.5),
      remote: r() > 0.6,
    };
  });
})();

const CITIES: [string, number, number][] = [['Stockholm', 7, 4], ['Madrid', 15, 4], ['Oslo', 6, 4], ['Lisbon', 17, 3]];

export const weatherCSV = (() => {
  const r = rng(3);
  const lines = ['date,city,temp_max,temp_min,rainfall_mm,humidity'];
  for (let d = 365; d > 0; d--) {
    const t = new Date(NOW - d * DAY);
    const season = -Math.cos(((t.getUTCMonth() * 30 + t.getUTCDate() - 15) / 365) * 2 * Math.PI);
    for (const [city, mean, amp] of CITIES) {
      const max = r2(mean + season * amp * 3 + (r() - 0.5) * 5);
      const rain = r() < 0.35 ? r2(r() * 12) : 0;
      lines.push([t.toISOString().slice(0, 10), city, max, r2(max - 4 - r() * 5), rain, Math.round(55 + rain * 2 + r() * 25)].join(','));
    }
  }
  return lines.join('\n');
})();

export const cities = [
  ['Tokyo', 'Japan', 35.68, 139.69, 37.4, 2194], ['Delhi', 'India', 28.61, 77.21, 32.9, 1484], ['Shanghai', 'China', 31.23, 121.47, 28.5, 6341],
  ['São Paulo', 'Brazil', -23.55, -46.63, 22.4, 1521], ['Mexico City', 'Mexico', 19.43, -99.13, 22.1, 1485], ['Cairo', 'Egypt', 30.04, 31.24, 21.7, 3085],
  ['Mumbai', 'India', 19.08, 72.88, 21.3, 603], ['Beijing', 'China', 39.9, 116.4, 21.3, 16411], ['Dhaka', 'Bangladesh', 23.81, 90.41, 22.5, 306],
  ['Osaka', 'Japan', 34.69, 135.5, 19.0, 225], ['New York', 'USA', 40.71, -74.01, 18.9, 783], ['Karachi', 'Pakistan', 24.86, 67.0, 17.2, 3780],
  ['Buenos Aires', 'Argentina', -34.6, -58.38, 15.4, 203], ['Istanbul', 'Turkey', 41.01, 28.98, 15.6, 5343], ['Lagos', 'Nigeria', 6.52, 3.38, 15.4, 1171],
  ['Manila', 'Philippines', 14.6, 120.98, 14.4, 43], ['Rio de Janeiro', 'Brazil', -22.91, -43.17, 13.6, 1221], ['Los Angeles', 'USA', 34.05, -118.24, 12.5, 1302],
  ['Moscow', 'Russia', 55.76, 37.62, 12.6, 2511], ['Paris', 'France', 48.86, 2.35, 11.1, 105], ['London', 'UK', 51.51, -0.13, 9.6, 1572],
  ['Lima', 'Peru', -12.05, -77.04, 11.0, 2672], ['Bangkok', 'Thailand', 13.76, 100.5, 10.9, 1569], ['Seoul', 'South Korea', 37.57, 126.98, 10.0, 605],
  ['Sydney', 'Australia', -33.87, 151.21, 5.4, 12368], ['Stockholm', 'Sweden', 59.33, 18.07, 1.7, 188], ['Nairobi', 'Kenya', -1.29, 36.82, 5.3, 696],
].map(([city, country, latitude, longitude, population_m, area_km2]) => ({ city, country, latitude, longitude, population_m, area_km2 }));

const TEAMS = ['Falcons', 'Wolves', 'Herons', 'Lynx'];
const POS = ['Forward', 'Midfield', 'Defence', 'Keeper'];

export const football = (() => {
  const r = rng(9);
  return Array.from({ length: 64 }, (_, i) => {
    const pos = POS[i % 4 === 3 && r() > 0.5 ? 3 : Math.floor(r() * 3)];
    const minutes = Math.round(400 + r() * 2600);
    const att = pos === 'Forward' ? 1 : pos === 'Midfield' ? 0.45 : pos === 'Defence' ? 0.1 : 0;
    const goals = Math.round((minutes / 90) * att * 0.55 * (0.5 + r()));
    return {
      player: `${FIRST[i % 16]} ${LAST[Math.floor(i / 16) % 8]}`,
      team: TEAMS[i % 4],
      position: pos,
      minutes_played: minutes,
      goals,
      assists: Math.round((minutes / 90) * (att * 0.3 + 0.08) * r()),
      rating: r2(6 + goals * 0.08 + r() * 1.5),
    };
  });
})();

export const CORPUS: { id: string; name: string; note: string; data: unknown }[] = [
  { id: 'steam', name: 'Steam library', note: 'Raw GetOwnedGames shape: nested envelope, epoch seconds, 0 for never.', data: steam },
  { id: 'iot', name: 'IoT sensors', note: 'Hourly readings from 4 devices, ISO times, nested lat/lng.', data: iot },
  { id: 'sales', name: 'Sales orders', note: 'Day-first dates (dd/mm/yyyy), regions, products.', data: sales },
  { id: 'employees', name: 'Employees', note: 'Ids, names, departments, booleans, non-additive salary.', data: employees },
  { id: 'weather', name: 'Weather (CSV)', note: 'A CSV string: every value starts as text.', data: weatherCSV },
  { id: 'cities', name: 'World cities', note: 'Latitude/longitude with population.', data: cities },
  { id: 'football', name: 'Football players', note: 'Sports season stats.', data: football },
];
