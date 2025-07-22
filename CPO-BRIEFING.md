## Hey! Welcome to the RSS Reader Project 👋

So you're diving into my RSS reader - awesome! Let me give you the quick tour of what this thing is and where we're at.

### What We Built

This is basically my personal RSS reader that I use every day. It's a web app that:
- Syncs with my Inoreader account (pulls in about 69 feeds)
- Lives on my home network (only accessible via Tailscale VPN)
- Has AI summaries powered by Claude
- Works on my phone, iPad, and Mac as a PWA

**Live at**: http://100.96.166.53:3147/reader

The whole thing is production-ready and I use it daily. We've got automatic syncing twice a day, and it even syncs my read/unread status back to Inoreader so everything stays in sync across devices.

### The Architecture (Quick Version)

We went with a server-client split:
- **Server**: Handles all the heavy lifting (Inoreader API, AI summaries, content extraction)
- **Client**: Just displays stuff and lets me interact with articles
- **Database**: Supabase (PostgreSQL) sits in the middle

No login needed because Tailscale handles access control. If you're on my network, you're in.

### The Documentation Problem 😅

Okay, real talk - the docs are a mess. Here's what's happening:

**Problem 1: Everything is mixed together**
- The TODOs file is 853 lines of completed and incomplete tasks all jumbled up
- The PRD has both "here's what we built" and "here's what we want to build"
- Can't tell what's done vs what's planned without reading everything

**Problem 2: No clear priorities**
- Got a bunch of feature ideas but no sense of what matters most
- Some stuff is marked P1, P2, P3 but it's scattered everywhere
- Hard to know what to work on next

**Problem 3: Technical details are everywhere**
- API docs in one place, database schema in another
- Implementation notes scattered across multiple files
- No single place to understand how it all works

### What I Need From You

**Goal 1: Make sense of what exists**
- Figure out what features are actually built and working
- Understand the current technical architecture
- Get a handle on what users (well, me) can actually do today

**Goal 2: Create clarity on what's next**
- What features are partially done that need finishing?
- What are the actual priorities based on user value?
- What technical debt needs addressing?

**Goal 3: Make the docs useful for the team**
- Engineers need to know how to build features
- Designers need to understand the current UI patterns
- You need to track what we're building and why

### Some Context That Might Help

- This started as a side project but it's pretty sophisticated now
- I have ADHD so the tool is designed around my reading habits
- We're limited to 100 API calls/day to Inoreader (shapes a lot of decisions)
- Eventually want to open-source this under GPL
- The current features work great, but there's UI for features that don't exist yet

### Where to Start

The main docs are in `/docs` but honestly, I'd recommend:
1. Actually use the app first (I'll get you Tailscale access)
2. Look at the PRD to understand the vision
3. Check out TODOs.md to see the chaos we're dealing with
4. Browse the CHANGELOG to see how we got here

### What Success Looks Like

By the end, the team should be able to answer:
- "What can the app do today?"
- "What should we build next and why?"
- "How do I implement feature X?"
- "Where do I find information about Y?"

You've got full freedom to reorganize things however makes sense. The current structure isn't sacred - it just grew organically as I built features. Make it work for how the team actually needs to use it.

### Quick Wins to Consider

There are some server endpoints that work perfectly but have no UI:
- Fetching full article content (server extracts it, but no button to trigger it)
- Generating AI summaries (same deal - works great, no UI)

Also, some basic stuff like searching for feeds or seeing when we last synced - all backend ready, just needs frontend love.

---

Let me know what questions you have! Happy to walk through any part of this. The app works great for my daily reading, but the docs... yeah, they need your magic touch. 🪄