# Changelog

All notable changes to Shayon's News RSS Reader PWA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial project setup with Next.js 14 and TypeScript
- Development environment configuration with quality gates
- Comprehensive development documentation
- GitHub project automation and workflow setup
- Progressive Web App foundation (in progress)

### Changed

- N/A

### Deprecated

- N/A

### Removed

- N/A

### Fixed

- N/A

### Security

- Environment variable template with secure configuration patterns

## [0.1.0] - 2025-01-06

### Added

- **Development Environment** (Issue #2)
  - Environment variables template with Inoreader OAuth setup (3 values)
  - Enhanced npm scripts for development workflow
  - Pre-commit quality gates (type-check, lint, format)
  - Development setup documentation
  - Clean, format, and debug scripts
- **Project Infrastructure** (Issue #1)

  - GitHub Project board with custom fields and automation
  - Issue templates and labels system
  - Automated project workflow for issue management
  - Milestone planning for 12-week development cycle

- **Next.js Foundation** (Issue #8)
  - Next.js 14 with App Router configuration
  - TypeScript 5+ with strict mode
  - Tailwind CSS v3+ with Typography plugin
  - ESLint and Prettier configuration
  - Basic project structure and dependencies

### Technical Details

- **Quality Gates**: All builds pass type-check, lint, and format validation
- **Development Scripts**:
  - `npm run dev:debug` - Development with Node.js debugger
  - `npm run dev:turbo` - Development with Turbo mode
  - `npm run pre-commit` - Complete quality check pipeline
  - `npm run clean` - Clean build artifacts and cache
- **Documentation**: Comprehensive setup guide in `docs/development-setup.md`

### Environment

- Node.js 18.17+ required
- Environment variables: Inoreader Client ID/Secret, Anthropic API key
- Development port: 3000 (configurable)

### Next Milestone

Epic 1: Foundation & Authentication - PWA implementation starting with Issue #5 (US-001: Initial App Setup)
