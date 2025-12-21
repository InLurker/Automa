# Astro-nomy (Static Version)

A **fully static** fork of the original [Astronomy](https://github.com/mickasmt/astro-nomy) project, converted to use **Astro v5**, **React 19**, and **Tailwind CSS v4** without any backend dependencies.

This project demonstrates modern static site development with the latest versions of these powerful technologies.

![blog](public/og.jpg)

> **Note**
> This is a static version of the original project by [@miickasmt](https://twitter.com/miickasmt), upgraded to Astro v5, React 19, and Tailwind CSS v4, with all backend features removed for pure static site generation.

## About this project

This static version demonstrates:

- **Astro v5** - Latest version configured for static site generation
- **React 19** - With the new React compiler for interactive components
- **Tailwind CSS v4** - Latest version with improved developer experience
- **No Backend** - Pure static site with no server-side dependencies

The original project included authentication, subscriptions, and API routes. This version has been converted to a fully static site that can be deployed anywhere without backend infrastructure.

See [STATIC_CONVERSION.md](./STATIC_CONVERSION.md) for details on what was changed.

## Project Structure

```
├── public/
│   └── fonts/
├── src/
│   ├── components/
│   ├── config/
│   ├── content/
│   ├── hooks/
│   ├── icons/
│   ├── layouts/
│   ├── lib/
│   ├── pages/
│   ├── styles/
│   └── types/
├── astro.config.mjs
├── README.md
├── package.json
├── tailwind.config.cjs
└── tsconfig.json
```

## Features

- ✅ **Astro v5** - Static site generation
- ✅ **React 19** - Interactive UI components
- ✅ **Tailwind CSS v4** - Modern styling
- ✅ **View Transitions** - Smooth page navigation
- ✅ **React Components & Hooks** - Interactive features
- ✅ **UI Components** - Built using **shadcn/ui**
- ✅ **Documentation & Blog** - Using **MDX** and **Content Collections**
- ✅ **TypeScript** - Fully typed
- ✅ **100/100 Lighthouse** - Perfect performance score
- ✅ **RSS Feed** - Automatic feed generation
- ✅ **Sitemap** - SEO-friendly sitemap
- ✅ **Responsive Design** - Mobile-first approach
- ✅ **Dark Mode** - Theme toggle support

### Removed Features (Static Version)
- ❌ Authentication (Supabase)
- ❌ Database operations
- ❌ Email notifications (Resend)
- ❌ API endpoints
- ❌ Server-side rendering
- ❌ Form submissions

All form pages now show disabled demo versions with clear messaging.

## Deployment

This is a fully static site and can be deployed to any static hosting service:

- **Vercel** (recommended)
- **Netlify**
- **Cloudflare Pages**
- **GitHub Pages**
- **AWS S3 + CloudFront**
- Any other static file hosting

### Build for Production

```sh
npm run build
```

Static files will be generated in the `dist/` directory.

### Preview Production Build

```sh
npm run preview
```

## Running Locally

1. Install dependencies:

```sh
npm install
```

2. Start the development server:

```sh
npm run dev
```

No environment variables or backend setup required! This is a fully static site.

## Credit

- Original project [Astronomy](https://github.com/mickasmt/astro-nomy) by [@miickasmt](https://twitter.com/miickasmt)
- Upgraded to Astro v5, React 19, and Tailwind CSS v4
- The original theme was based off of the example app [Taxonomy](https://tx.shadcn.com/) by shadcn

## License

Licensed under the [MIT license](https://github.com/mickasmt/astro-nomy/blob/main/LICENSE.md).
