# OG Image Generator

Dynamic OG images for [iammatthias.com](https://iammatthias.com).

## Routes

- `/` - Homepage image
- `/{category}` - Category page (e.g., `/posts`)
- `/{category}-{title}` - Content page (e.g., `/posts-my-article-title`)

## Development

Install dependencies:

```bash
bun install
```

Run locally:

```bash
bun run dev
```

Visit `http://localhost:8787/` to test.

## Deploy

```bash
bun run deploy
```
