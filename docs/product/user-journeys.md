# User Journeys - Shayon's News

## Overview

This document maps out the emotional and contextual journeys of using the RSS Reader PWA, focusing on user needs, pain points, and satisfactions throughout their experience with the server-client architecture.

## Primary User Persona: Shayon

- **Tech-savvy** product manager with ADHD
- **News enthusiast** who values staying informed efficiently
- **Time-conscious** professional who reads during commute and breaks
- **Prefers** clean, distraction-free interfaces
- **Values** privacy and control over his data
- **Frustrated by** partial feeds, API limits, and information overload

## User Journey Maps

### Journey 1: Morning News Catch-up

**Scenario**: Weekday morning, 7:30 AM, having coffee before work

**Emotional Journey**:

```
😴 Groggy → 📱 Connected → 😌 Focused → 😊 Satisfied → ✅ Informed
```

**Touchpoints**:

1. **Opening the App via Tailscale**
   - _Context_: Just woke up, checking phone while coffee brews
   - _Emotion_: Routine, comfortable
   - _Action_: Opens browser, navigates to http://100.96.166.53/reader
   - _Experience_: Instant load from PWA, no login needed
   - _Thought_: "Good, straight to my news"

2. **Checking Last Sync Time**
   - _Context_: Automatic sync ran overnight
   - _Emotion_: Curious about new content
   - _Action_: Glances at "Last sync: 3 hours ago"
   - _Experience_: 47 new articles since last read
   - _Thought_: "Perfect amount to catch up on"

3. **Browsing with Tabs**
   - _Context_: Wants to check specific tech feeds
   - _Emotion_: Focused, selective
   - _Action_: Switches to Feeds tab, expands Tech folder
   - _Experience_: Clear unread counts per feed
   - _Thought_: "I'll start with Ars Technica (12)"

3a. **Navigating to Filtered View (RR-216 Enhancement)**

- _Context_: Taps on Ars Technica feed
- _Emotion_: Expectant
- _Action_: Navigation to Articles tab with feed filter
- _Experience_: Immediately sees only Ars Technica articles, no flash of all articles
- _Thought_: "Perfect, exactly what I wanted to see"

4. **Reading with AI Summaries**
   - _Context_: Limited time before work
   - _Emotion_: Efficient, satisfied
   - _Action_: Scans list with full summaries visible
   - _Experience_: 150-word summaries capture essence
   - _Thought_: "I can get through all of these"

**Pain Points Addressed**:

- No authentication hassle → Direct Tailscale access
- Information overload → AI summaries in list view
- Time pressure → Efficient scanning
- Navigation confusion → Reliable filter state preservation (RR-216)

### Journey 2: Deep Dive Research

**Scenario**: Lunch break, researching for work project

**Emotional Journey**:

```
🎯 Purposeful → 🔍 Filtering → 📖 Reading → 💡 Learning → 📋 Satisfied
```

**Touchpoints**:

1. **Tag-Based Filtering**
   - _Context_: Needs AI/ML specific articles
   - _Emotion_: Focused, professional
   - _Action_: Switches to Tags tab, taps "artificial-intelligence"
   - _Experience_: Article list filters instantly, no delay or incorrect results
   - _Thought_: "Much faster than searching"

1a. **Filter State Reliability (RR-216 Improvement)**

- _Context_: Uses browser back button after reading an article
- _Emotion_: Efficient
- _Action_: Returns to filtered tag view
- _Experience_: Still sees only AI/ML articles, filter state preserved
- _Thought_: "Great, I don't have to re-filter"

2. **Fetching Full Content**
   - _Context_: RSS snippet isn't enough
   - _Emotion_: Slightly impatient
   - _Action_: Opens article, taps "Fetch Full Content"
   - _Experience_: Server fetches and cleans article
   - _Thought_: "No more jumping to websites"

3. **Generating Fresh Summary**
   - _Context_: Long technical article
   - _Emotion_: Time-conscious
   - _Action_: Taps "Summarize" button
   - _Experience_: 175-word summary appears in 3 seconds
   - _Thought_: "This captures the key points perfectly"

4. **Manual Sync for Latest**
   - _Context_: Wants most recent news
   - _Emotion_: Anticipatory
   - _Action_: Taps sync button in settings
   - _Experience_: "Syncing..." then "12 new articles"
   - _Thought_: "Great, fresh content"

**Pain Points Addressed**:

- Finding specific content → Tag filtering
- Partial feeds → Server-side content fetching
- Need for summaries → On-demand generation
- Filter state loss during navigation → Race condition prevention (RR-216)

### Journey 3: Commute Reading (Limited Connection)

**Scenario**: Train commute with spotty internet

**Emotional Journey**:

```
🚇 Commuting → 📱 Opening → ⚠️ Connection Issues → 📚 Reading Cached → 😊 Engaged
```

**Touchpoints**:

1. **Accessing via Tailscale**
   - _Context_: On train, phone connected to Tailscale
   - _Emotion_: Routine
   - _Action_: Opens PWA from home screen
   - _Experience_: Loads from Supabase cache
   - _Thought_: "Good thing Tailscale is stable"

2. **Reading Cached Articles**
   - _Context_: Supabase connection intermittent
   - _Emotion_: Focused on content
   - _Action_: Reads already-loaded articles
   - _Experience_: All article data available
   - _Thought_: "At least I can read what's here"

3. **Marking Read States**
   - _Context_: Going through articles
   - _Emotion_: Organized
   - _Action_: Marks articles as read
   - _Experience_: Updates save to Supabase when connected
   - _Thought_: "It'll sync when connection improves"

4. **Attempting Full Content**
   - _Context_: Wants full article
   - _Emotion_: Slightly frustrated
   - _Action_: Taps "Fetch Full Content"
   - _Experience_: "Connection error - try again later"
   - _Thought_: "I'll fetch this at home"

**Pain Points Addressed**:

- Spotty connection → Local Supabase caching
- Can't fetch new content → Clear error messages
- Read state tracking → Syncs when possible

### Journey 5: Rapid Article Processing (RR-197 Optimization)

**Scenario**: Power user quickly processing large batch of articles during break

**Emotional Journey**:

```
⚡ Efficient → 🎯 Focused → 🚀 Flow State → ✨ Satisfied → 📊 Accomplished
```

**Touchpoints**:

1. **Opening Large Article List**
   - _Context_: 80+ unread articles accumulated over weekend
   - _Emotion_: Determined to catch up quickly
   - _Action_: Opens "All Articles" view with unread filter
   - _Experience_: List loads instantly, smooth 60fps scrolling
   - _Thought_: "This feels responsive, I can move fast"

2. **Rapid Article Marking**
   - _Context_: Scanning headlines and marking read quickly
   - _Emotion_: In flow state, rapid decision making
   - _Action_: Marks 5+ articles per second as read/unread
   - _Experience_: **Instant UI feedback** - each tap shows immediate visual response (<1ms)
   - _Thought_: "Perfect! No lag, I can keep my rhythm"

3. **Counter Updates During Rapid Marking**
   - _Context_: Watch unread count decrease while marking
   - _Emotion_: Satisfied with progress tracking
   - _Action_: Continues rapid marking while observing sidebar counts
   - _Experience_: **Real-time counter updates** with race condition prevention
   - _Thought_: "The counts are always accurate, even when I'm going fast"

4. **Database Sync Transparency**
   - _Context_: Marking 50+ articles in rapid succession
   - _Emotion_: Confident in system reliability
   - _Action_: Continues rapid marking without worrying about sync
   - _Experience_: **Background batching** (500ms intervals) handles database updates invisibly
   - _Thought_: "I don't even need to think about whether it's saving"

5. **Memory Management During Long Sessions**
   - _Context_: Extended marking session with 100+ operations
   - _Emotion_: Trusting system performance
   - _Action_: Continues rapid article processing
   - _Experience_: **FIFO cleanup** prevents localStorage bloat, maintains performance
   - _Thought_: "Still fast even after marking so many articles"

**Performance Benefits Experienced**:

- **<1ms Response Time**: Every tap provides instant visual feedback
- **60fps Scrolling**: Smooth scrolling maintained during rapid interactions
- **Race Condition Prevention**: Accurate counter updates even at 5+ articles/second
- **Memory Management**: Consistent performance during extended sessions
- **Background Batching**: Database operations don't block UI interactions

**Pain Points Addressed**:

- Sluggish UI during rapid marking → localStorage optimization provides instant feedback
- Counter over-decrementing → Set-based tracking prevents duplicate decrements
- Database blocking UI → Three-tier architecture with background batching
- Memory bloat during long sessions → FIFO cleanup at 1000-entry limit
- Performance degradation → Real-time monitoring maintains 60fps targets

### Journey 4: Weekend Leisure Reading

**Scenario**: Saturday morning, relaxed browsing

**Emotional Journey**:

```
☕ Relaxed → 🎨 Appreciative → 🌓 Adjusting → 📖 Immersed → 😌 Content
```

**Touchpoints**:

1. **Leisurely Opening**
   - _Context_: No rush, coffee in hand
   - _Emotion_: Relaxed, curious
   - _Action_: Opens reader on tablet
   - _Experience_: Beautiful, clean interface
   - _Thought_: "This design is so calming"

2. **Exploring Feed Hierarchy**
   - _Context_: Time to explore different topics
   - _Emotion_: Curious, open
   - _Action_: Browses folders: Tech, Politics, Culture
   - _Experience_: Unread counts guide exploration
   - _Thought_: "Let's see what's in Culture today"

3. **Theme Adjustment**
   - _Context_: Bright morning light
   - _Emotion_: Comfortable
   - _Action_: Toggles to light theme
   - _Experience_: Instant change, persists
   - _Thought_: "Much better for morning reading"

4. **Discovering Through Tags**
   - _Context_: Interested in specific topic
   - _Emotion_: Explorative
   - _Action_: Switches to Tags tab
   - _Experience_: Different article grouping than feeds
   - _Thought_: "Nice to see cross-feed connections"

**Pain Points Addressed**:

- Eye strain → Theme toggle
- Content discovery → Dual organization (feeds/tags)
- Relaxed reading → Clean, minimal interface

### Journey 5: Hitting API Limits

**Scenario**: Heavy news day, multiple manual syncs

**Emotional Journey**:

```
📰 Excited → 🔄 Syncing → ⚠️ Warning → 🛑 Limited → 😤 Frustrated → 🤔 Understanding
```

**Touchpoints**:

1. **Breaking News Event**
   - _Context_: Major tech announcement
   - _Emotion_: Excited, urgent
   - _Action_: Opens reader, hits sync
   - _Experience_: "Syncing... 73 new articles"
   - _Thought_: "Wow, everyone's covering this"

2. **Multiple Syncs**
   - _Context_: Checking for updates hourly
   - _Emotion_: Engaged, following story
   - _Action_: Manual sync throughout day
   - _Experience_: Each sync brings 10-20 articles
   - _Thought_: "Good, getting all perspectives"

3. **API Limit Warning**
   - _Context_: 5th manual sync of the day
   - _Emotion_: Surprised
   - _Action_: Tries to sync again
   - _Experience_: "API limit reached (100/100 calls today)"
   - _Thought_: "Oh right, there's a limit"

4. **Understanding the System**
   - _Context_: Reads error message
   - _Emotion_: Accepting
   - _Action_: Checks last sync timestamp
   - _Experience_: "Last sync: 12 minutes ago"
   - _Thought_: "I have plenty to read anyway"

**Pain Points Addressed**:

- API limits → Clear messaging
- Rate limiting → Shows usage count
- Frustration → Explains limits reset daily

## Emotional Highs and Lows

### Highs 😊

- No login required - just works
- Summaries save significant time
- Server handles all the complex stuff
- Beautiful, distraction-free reading
- Feed organization preserved perfectly
- Full content fetching is magical

### Lows 😤

- Must be on Tailscale network
- API limits can be restrictive
- Can't sync when server is down
- No offline sync capability
- Manual content fetching per article
- Summaries cost extra API calls

## Key Moments of Truth

1. **First Access**: Tailscale requirement understood
2. **First Sync**: Server reliability sets expectations
3. **First Summary**: AI quality impresses
4. **First Full Content**: Server fetch must work
5. **First API Limit**: Understanding the constraint
6. **First Server Down**: Graceful degradation

## Opportunities for Delight

1. **Zero Login**: Just open and read
2. **Perfect Summaries**: Feel informed quickly
3. **Clean Architecture**: Everything just works
4. **Beautiful Typography**: Joy in reading
5. **Smart Server**: Handles complexity invisibly
6. **Preserved Organization**: Feeds and tags intact

## Pain Points by Design

These are conscious trade-offs for the single-user architecture:

1. **Tailscale Only**: Security over convenience
2. **API Limits**: Cost control, not a bug
3. **No Multi-User**: Simplicity first
4. **Server Dependency**: Centralized control
5. **Manual Full Content**: API conservation
6. **Basic Offline**: Supabase cache only

## Success Metrics from User Perspective

- Can review 100+ articles in 15 minutes with summaries
- Never worry about authentication or accounts
- Server sync "just works" automatically
- Full content available when needed
- Understand API limits and work within them
- Feel in control of my news consumption
- Enjoy the reading experience every time
- **Performance Excellence (RR-197)**: Can rapidly mark 5+ articles/second with instant feedback
- **Smooth Interactions**: 60fps performance maintained during rapid article processing
- **Reliable Counters**: Accurate unread counts even during high-speed article marking
