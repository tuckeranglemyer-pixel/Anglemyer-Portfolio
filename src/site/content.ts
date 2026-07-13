// ─────────────────────────────────────────────────────────────────────────────
//  content.ts — the single source of truth for everything on the site.
//
//  This is the ONLY file you need to edit to update the portfolio. Swap the
//  placeholder entries (marked `placeholder: true`) for your real work.
//  Anything with `placeholder: true` renders with a subtle "replace me" look
//  so you can see at a glance what still needs real content.
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

export interface TikTokVideo {
  url: string
  caption: string
  views: string
  thumb?: string
  placeholder?: boolean
}

export interface TikTok {
  handle: string
  url: string
  followers: string
  likes: string
  blurb: string
  videos: TikTokVideo[]
}

// ── Profile ──────────────────────────────────────────────────────────────────
export const PROFILE: Profile = {
  name: 'Tucker Anglemyer',
  eyebrow: 'Providence College · Accounting & Finance · Incoming PwC · Founder, Untracked',
  lede:
    'I design and build websites, ship code, and run Untracked. This is a running record of the work — client sites, the code behind them, and the things I make on the internet.',
  email: 'tucker@untrackedmusic.com',
  socials: [
    { label: 'GitHub', href: 'https://github.com/tuckeranglemyer-pixel' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tucker-anglemyer-42a13a32b' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@untrackedmusic' },
  ],
}

// ── Selected Work — client websites you've designed & built ──────────────────
//  TODO: replace these three placeholders with your real client sites.
//  For each: a title, the client name, your role, year, the live URL, and
//  ideally a screenshot dropped in /public/work/<name>.jpg referenced via `image`.
export const WORK: WorkItem[] = [
  {
    title: 'Client Site One',
    client: 'Client name',
    role: 'Design & build',
    year: '2025',
    url: '#',
    tags: ['Web design', 'Development'],
    blurb:
      'One or two lines on what you built for them and the outcome — “a full redesign that doubled their inbound bookings,” etc.',
    placeholder: true,
  },
  {
    title: 'Client Site Two',
    client: 'Client name',
    role: 'Development',
    year: '2025',
    url: '#',
    tags: ['Next.js', 'CMS'],
    blurb: 'What the site does and why it mattered to the client.',
    placeholder: true,
  },
  {
    title: 'Client Site Three',
    client: 'Client name',
    role: 'Design & build',
    year: '2024',
    url: '#',
    tags: ['Landing page', 'Branding'],
    blurb: 'The problem, what you shipped, and the result.',
    placeholder: true,
  },
]

// ── Code & Fixes — GitHub work, open-source contributions, PRs ───────────────
//  TODO: replace with your real repos / merged PRs / notable fixes.
export const CODE: CodeItem[] = [
  {
    title: 'Bug fix title',
    repo: 'owner/repo',
    description:
      'What was broken, what you changed, and the impact. Link goes straight to the merged PR or commit.',
    url: 'https://github.com/tuckeranglemyer-pixel',
    kind: 'Merged PR',
    placeholder: true,
  },
  {
    title: 'Project or library',
    repo: 'tuckeranglemyer-pixel/repo',
    description: 'A repo you own — what it does and the stack.',
    url: 'https://github.com/tuckeranglemyer-pixel',
    kind: 'Open source',
    placeholder: true,
  },
  {
    title: 'Notable contribution',
    repo: 'owner/repo',
    description: 'A fix or feature you contributed upstream.',
    url: 'https://github.com/tuckeranglemyer-pixel',
    kind: 'Fix',
    placeholder: true,
  },
]

// ── TikTok — you blew up here, so lead with the numbers ──────────────────────
//  TODO: update followers/likes and swap in your best-performing videos.
export const TIKTOK: TikTok = {
  handle: '@untrackedmusic',
  url: 'https://www.tiktok.com/@untrackedmusic',
  followers: '000K',
  likes: '0.0M',
  blurb:
    'Building Untracked in public — the videos that took off and put the project on the map.',
  videos: [
    { url: 'https://www.tiktok.com/@untrackedmusic', caption: 'Top video', views: '0.0M', placeholder: true },
    { url: 'https://www.tiktok.com/@untrackedmusic', caption: 'Top video', views: '000K', placeholder: true },
    { url: 'https://www.tiktok.com/@untrackedmusic', caption: 'Top video', views: '000K', placeholder: true },
    { url: 'https://www.tiktok.com/@untrackedmusic', caption: 'Top video', views: '000K', placeholder: true },
  ],
}

// ── Ventures — the two things you're actually building (real copy) ───────────
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
