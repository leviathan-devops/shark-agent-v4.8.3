# Manta Agent

Dual-brain sequential agent (Plan ↔ Build) with mechanical coordinator for OpenCode.

## Quick Start

```bash
git clone https://github.com/leviathan-devops/manta-agent.git
cd manta-agent
npm install
npm run build
```

## Installation

Add to OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": [
    "file:///path/to/manta-agent/dist",
    "list"
  ]
}
```

## Architecture

- **Plan Brain**: Analysis, design, SPEC.md generation
- **Build Brain**: Execute exactly what SPEC.md specifies
- **Coordinator**: Mechanical brain switching (no agent override)

## Tags

- `v4.6` - Last working version before v4.7 modifications

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run build` | Build plugin bundle |
| `npm run test` | Run tests |

## State

State is isolated to `.manta/` directory in workspace.
