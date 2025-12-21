# Automa

A minimalist zen playground for interactive animations built with **Astro v5**, **React 19**, and **Tailwind CSS v4**.

![Automa](public/og.jpg)

## About

Automa is a high-contrast, minimalist static site showcasing self-contained interactive animation modules. Each automa is a unique visual experience with real-time parameter controls.

### Features

- ✨ **Schema-driven controls** - Define parameters once, get UI automatically
- 🎨 **Three themes** - Flow, Structure, and Rhythm
- 🎯 **Reusable components** - Shared control library across all automa
- 🔒 **Iframe isolation** - Each automa runs independently
- ⚡ **Real-time updates** - Live parameter changes via postMessage
- 🌙 **Dark zen aesthetic** - High contrast minimalist design
- 📱 **Fully responsive** - Works on all screen sizes
- 🚀 **100% static** - No backend required

## Current Automa

### Flow Theme
- **Drift** - Calm drifting particles with gentle directional flow

### Structure Theme
- **Lattice** - A geometric lattice that subtly breathes and deforms

### Rhythm Theme
- **Pulse** - Concentric rings that pulse rhythmically with falloff

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Visit `http://localhost:4321/explore` to see all automa.

### Build

```bash
npm run build
```

Static files will be generated in the `dist/` directory.

### Preview

```bash
npm run preview
```

## Project Structure

```
src/
├── components/
│   └── automa/              # Control UI components
├── config/
│   └── automa-registry.ts   # Automa definitions
├── pages/
│   ├── explore.astro        # Discovery page
│   └── automa/[slug].astro  # Dynamic automa viewer
└── types/
    └── automa.ts            # TypeScript definitions

public/
└── automa/
    ├── drift/               # Drift automa implementation
    ├── lattice/             # Lattice automa implementation
    └── pulse/               # Pulse automa implementation
```

## Adding New Automa

See [AUTOMA_SYSTEM.md](./AUTOMA_SYSTEM.md) for detailed documentation on:

- Architecture overview
- Parameter schema system
- PostMessage protocol
- Step-by-step guide to adding new automa
- Best practices

### Quick Example

1. Add entry to `src/config/automa-registry.ts`
2. Create HTML file in `public/automa/[name]/index.html`
3. Implement animation with postMessage handling
4. Build and test

## Technology Stack

- **Astro v5** - Static site generation
- **React 19** - Interactive UI components
- **Tailwind CSS v4** - Styling
- **TypeScript** - Type safety
- **shadcn/ui** - UI component library

## Deployment

Deploy to any static hosting service:

- Vercel (recommended)
- Netlify
- Cloudflare Pages
- GitHub Pages
- AWS S3 + CloudFront

## Documentation

- [Automa System](./AUTOMA_SYSTEM.md) - Complete system documentation
- [Static Conversion](./STATIC_CONVERSION.md) - Migration from original template

## License

Licensed under the [MIT license](./LICENCE.md).

## Credits

Built on the [Astro Nomy](https://github.com/mickasmt/astro-nomy) template by [@miickasmt](https://twitter.com/miickasmt), upgraded to Astro v5, React 19, and Tailwind CSS v4 by [Dustin Turner](https://github.com/dustinturner).
