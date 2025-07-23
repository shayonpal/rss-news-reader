# Release Notes - v0.5.1

Release Date: July 23, 2025

## 🎯 Highlights

This release focuses on improving the reading experience with auto-mark functionality, enhanced mobile responsiveness, and a Reddit-style auto-hiding header for maximum screen real estate.

## ✨ New Features

### Auto-Mark Articles as Read on Scroll
- Articles are automatically marked as read when you scroll past them
- Smart detection only triggers on downward scroll to prevent accidental marking
- Batch processing for efficiency with 500ms debounce
- Articles remain visible in current view until navigation/filter change
- Visual feedback with smooth opacity transition (70%)

### Reddit-Style Auto-Hiding Header
- Header automatically hides when scrolling down (after 50px)
- Instantly reappears when scrolling up even 1px
- Smooth slide animation (300ms transition)
- Saves valuable screen space, especially on mobile devices
- Works on both article list and article detail views

## 🔧 Improvements

### Enhanced Article Headers
- Removed redundant filter prefixes for cleaner navigation
- Shows just "Articles" instead of "All/Unread/Read Articles"
- Displays folder/feed name directly when viewing specific collections

### Mobile-Responsive Header Text
- Fixed folder name truncation on mobile devices
- Long folder names now wrap instead of being cut off
- Responsive font sizing: text-lg (mobile) → text-xl (tablet) → text-2xl (desktop)

## 📱 iOS Safari Fixes
- Fixed Safari URL bar not collapsing when scrolling
- Fixed native iOS scroll-to-top gesture (tap status bar)
- Both article list and article detail views now support native iOS gestures

## 🚀 Performance
- Optimized scroll event handling with requestAnimationFrame
- Efficient batch processing for marking multiple articles as read
- Smooth animations and transitions throughout

## 📦 Installation

The app automatically updates if you have it installed as a PWA. For new installations, visit:
- Production: http://100.96.166.53:3147/reader

## 🔮 What's Next

- Enhanced AI summarization with multiple LLM providers
- Advanced filtering and search capabilities
- Improved offline reading experience