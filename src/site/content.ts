// ─────────────────────────────────────────────────────────────────────────────
//  content.ts — the single source of truth for everything on the site.
//
//  Edit this file to update the portfolio. Entries marked `placeholder: true`
//  render with a subtle dashed "replace me" look so you can see what still needs
//  real content. To add a screenshot to a work card, drop an image in
//  /public/work/<name>.jpg and set `image: '/work/<name>.jpg'`.
// ─────────────────────────────────────────────────────────────────────────────

export interface Profile {
  name: string
  eyebrow: string
  lede: string
  email: string
  socials: { label: string; href: string }[]
}

export interface WorkItem {
  title: string
  client: string
  role: string
  year: string
  url: string
  /** Path under /public or a full URL. Omit to get a generated monogram card. */
  image?: string
  tags: string[]
  blurb: string
  placeholder?: boolean
}

export interface CodeItem {
  title: string
  repo: string
  description: string
  url: string
  /** Short badge, e.g. "Merged PR", "Fix", "Open source". */
  kind: string
  placeholder?: boolean
}

export interface Venture {
  name: string
  meta: string
  tagline: string
  description: string
  url: string
  tags: string[]
}

export interface TikTok {
  handle: string
  url: string
  likes: string
  followers: string
  blurb: string
  featured: { caption: string; url: string }
}

// ── Profile ──────────────────────────────────────────────────────────────────
export const PROFILE: Profile = {
  name: 'Tucker Anglemyer',
  eyebrow: 'Providence College · Accounting & Finance · Incoming PwC · Founder, Untracked',
  lede:
    'I design and build websites, ship code, and run Untracked — a tool for finding music almost nobody has. This is the work: client sites, open-source fixes, and the things I make online.',
  email: 'tucker@untrackedmusic.com',
  socials: [
    { label: 'GitHub', href: 'https://github.com/tuckeranglemyer-pixel' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@tuck.angle' },
    { label: 'SoundCloud', href: 'https://soundcloud.com/tuckerq' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tucker-anglemyer-42a13a32b' },
  ],
}

// ── Selected Work — websites designed & built ────────────────────────────────
export const WORK: WorkItem[] = [
  {
    title: 'TWO THIRTY',
    client: 'twothirty.fm',
    role: 'Design & build',
    year: '2025',
    url: 'https://twothirty.fm',
    tags: ['Web design', 'Event site'],
    blurb:
      'Site for the Bushwick techno & UK-garage night — lineup, venue details, and RA ticketing behind a stripped-back, raw identity.',
  },
  {
    title: 'Untracked',
    client: 'untrackedmusic.com',
    role: 'Design & build',
    year: '2025',
    url: 'https://untrackedmusic.com',
    tags: ['React', 'WebGL', 'Terminal UI'],
    blurb:
      'The Untracked landing — a terminal-style “signal scanner” that decodes tracks in real time. “Almost nobody has this.”',
  },
  {
    // TODO: add another client site — name, live URL, your role, year, one-line outcome.
    title: 'Your next client site',
    client: 'Client name',
    role: 'Design & build',
    year: '2025',
    url: '#',
    tags: ['Web design', 'Development'],
    blurb: 'Add a client site here: what you built and the outcome it drove.',
    placeholder: true,
  },
]

// ── Code & Fixes — open-source contributions, repos, and fixes ───────────────
export const CODE: CodeItem[] = [
  {
    title: 'Running ACE-Step 1.5 on AMD (ROCm) — working setup + fixes',
    repo: 'ace-step/ACE-Step · Discussion #404',
    description:
      'Four fixes to get the ACE-Step AI music model training on AMD GPUs via ROCm on Windows. Multiple users replicated the setup and trained their own LoRA models — 9 comments, 16 replies.',
    url: 'https://github.com/ace-step/ACE-Step/discussions/404',
    kind: 'Open source',
  },
  {
    title: 'LoKr training on AMD RX 7900 XT + an undocumented instability',
    repo: 'ace-step/ACE-Step-1.5 · Discussion #1232',
    description:
      'A 16-minute working LoKr training config on AMD ROCm, plus the first documentation of a numerical instability in the Kronecker-factored path that nobody had reported.',
    url: 'https://github.com/ace-step/ACE-Step-1.5/discussions/1232',
    kind: 'Guide + bug report',
  },
  {
    title: 'untracked-audio-engine',
    repo: 'tuckeranglemyer-pixel/untracked-audio-engine',
    description: 'The audio-analysis engine behind Untracked’s music discovery. JavaScript.',
    url: 'https://github.com/tuckeranglemyer-pixel/untracked-audio-engine',
    kind: 'Repo',
  },
  {
    title: 'PokemonIsland',
    repo: 'tuckeranglemyer-pixel/PokemonIsland',
    description: 'So everyone can have a little Pokémon on their iPhone island. Swift.',
    url: 'https://github.com/tuckeranglemyer-pixel/PokemonIsland',
    kind: 'Repo',
  },
]

// ── TikTok — 90 followers, 73.7K likes: the videos travel further than the follow ─
export const TIKTOK: TikTok = {
  handle: '@tuck.angle',
  url: 'https://www.tiktok.com/@tuck.angle',
  likes: '73.7K',
  followers: '90',
  blurb:
    'Trying to find music you haven’t heard. 90 followers, 73.7K likes — the videos travel a lot further than the follower count.',
  featured: {
    caption:
      'went to kettama alone thinking I was gonna find my wife — it was 400 dudes w/ y2k sunglasses.',
    url: 'https://www.tiktok.com/@tuck.angle/video/7625370801780428045',
  },
}

// ── Ventures — the two things you're building ────────────────────────────────
export const VENTURES: Venture[] = [
  {
    name: 'Untracked',
    meta: 'Founder · untrackedmusic.com',
    tagline: 'The infrastructure underground music deserves.',
    description:
      'AI-powered music discovery for DJs. React, FastAPI, pgvector embeddings, and MERT audio analysis over 800+ enriched tracks.',
    url: 'https://untrackedmusic.com',
    tags: ['React', 'FastAPI', 'pgvector', 'MERT'],
  },
  {
    name: 'The War Room',
    meta: '1st place · yconic New England AI Hackathon · 24 hours',
    tagline: 'Three LLMs arguing about your product until they find the truth.',
    description:
      'A multi-agent adversarial product-analysis engine. Two people, 24 hours, first place — built against CS masters teams.',
    url: 'https://frontend-pi-seven-13.vercel.app/',
    tags: ['CrewAI', 'ChromaDB', 'DGX Spark'],
  },
]
