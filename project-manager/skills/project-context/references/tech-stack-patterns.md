# Tech Stack Detection Patterns

## Complete Detection Matrix

### JavaScript/TypeScript Ecosystem

| Detection Target | Primary File | Secondary Files | Key Indicators |
|------------------|--------------|-----------------|----------------|
| Node.js | `package.json` | `node_modules/` | `"type": "module"` or `"main"` field |
| Deno | `deno.json` | `deno.lock`, `import_map.json` | URL imports in `.ts` files |
| Bun | `bun.lockb` | `bunfig.toml` | Bun-specific APIs |
| TypeScript | `tsconfig.json` | `*.ts`, `*.tsx` | `"compilerOptions"` |

### Frontend Frameworks

| Framework | Primary Indicator | Config File | Typical Dependencies |
|-----------|-------------------|-------------|---------------------|
| React | `react` in deps | - | `react-dom`, `@types/react` |
| Next.js | `next` in deps | `next.config.js` | `next/image`, `next/link` |
| Vue | `vue` in deps | `vue.config.js` | `@vue/cli`, `vuex`, `pinia` |
| Nuxt | `nuxt` in deps | `nuxt.config.ts` | `@nuxt/` packages |
| Angular | `@angular/core` | `angular.json` | `@angular/` packages |
| Svelte | `svelte` in deps | `svelte.config.js` | `@sveltejs/kit` |
| SolidJS | `solid-js` in deps | - | `solid-start` |
| Qwik | `@builder.io/qwik` | - | `@builder.io/qwik-city` |
| Astro | `astro` in deps | `astro.config.mjs` | `@astrojs/` integrations |

### Backend Frameworks

| Framework | Primary Indicator | Config File | Typical Stack |
|-----------|-------------------|-------------|---------------|
| Express | `express` in deps | - | `cors`, `helmet`, `morgan` |
| Fastify | `fastify` in deps | - | `@fastify/` plugins |
| NestJS | `@nestjs/core` | `nest-cli.json` | `@nestjs/` modules |
| Koa | `koa` in deps | - | `koa-router`, `koa-body` |
| Hono | `hono` in deps | - | Edge runtime support |
| Elysia | `elysia` in deps | - | Bun-optimized |

### Python Ecosystem

| Framework/Tool | Primary Indicator | Config File |
|----------------|-------------------|-------------|
| FastAPI | `fastapi` in requirements | - |
| Django | `django` in requirements | `settings.py` |
| Flask | `flask` in requirements | - |
| Poetry | `pyproject.toml` with `[tool.poetry]` | - |
| Pipenv | `Pipfile` | `Pipfile.lock` |
| uv | `uv.lock` | - |

### Rust Ecosystem

| Tool/Framework | Primary Indicator | Config Section |
|----------------|-------------------|----------------|
| Actix | `actix-web` in Cargo.toml | - |
| Axum | `axum` in Cargo.toml | - |
| Rocket | `rocket` in Cargo.toml | - |
| Tokio | `tokio` in deps | `[features]` |
| Clap (CLI) | `clap` in deps | - |

### Go Ecosystem

| Framework | Primary Indicator | Import Pattern |
|-----------|-------------------|----------------|
| Gin | `gin-gonic/gin` | `github.com/gin-gonic/gin` |
| Fiber | `gofiber/fiber` | `github.com/gofiber/fiber` |
| Echo | `labstack/echo` | `github.com/labstack/echo` |
| Chi | `go-chi/chi` | `github.com/go-chi/chi` |

### Database Detection

| Database | Indicator Files | Dependencies |
|----------|-----------------|--------------|
| PostgreSQL | - | `pg`, `prisma`, `typeorm`, `knex` |
| MySQL | - | `mysql2`, `sequelize` |
| MongoDB | - | `mongoose`, `mongodb` |
| SQLite | `*.db`, `*.sqlite` | `better-sqlite3`, `sql.js` |
| Redis | - | `ioredis`, `redis` |
| Firebase | `firebase.json` | `firebase`, `firebase-admin` |
| Supabase | - | `@supabase/supabase-js` |
| PlanetScale | - | `@planetscale/database` |

### Testing Frameworks

| Framework | Indicator | Config File |
|-----------|-----------|-------------|
| Jest | `jest` in devDeps | `jest.config.js` |
| Vitest | `vitest` in devDeps | `vitest.config.ts` |
| Mocha | `mocha` in devDeps | `.mocharc.js` |
| Playwright | `@playwright/test` | `playwright.config.ts` |
| Cypress | `cypress` in devDeps | `cypress.config.js` |
| pytest | `pytest` in requirements | `pytest.ini`, `pyproject.toml` |

### Build Tools

| Tool | Indicator | Config File |
|------|-----------|-------------|
| Vite | `vite` in devDeps | `vite.config.ts` |
| Webpack | `webpack` in devDeps | `webpack.config.js` |
| esbuild | `esbuild` in devDeps | - |
| Rollup | `rollup` in devDeps | `rollup.config.js` |
| Turbopack | `turbo.json` with Next.js | - |
| Parcel | `parcel` in devDeps | - |
| SWC | `@swc/core` in devDeps | `.swcrc` |

### Monorepo Tools

| Tool | Indicator | Key Files |
|------|-----------|-----------|
| NX | `nx.json` | `workspace.json` |
| Turborepo | `turbo.json` | `packages/`, `apps/` |
| Lerna | `lerna.json` | `packages/` |
| pnpm Workspaces | `pnpm-workspace.yaml` | - |
| Yarn Workspaces | `"workspaces"` in package.json | - |

### CSS/Styling

| Tool | Indicator | Config File |
|------|-----------|-------------|
| Tailwind CSS | `tailwindcss` in devDeps | `tailwind.config.js` |
| Sass/SCSS | `sass` in devDeps | `*.scss` files |
| styled-components | `styled-components` in deps | - |
| Emotion | `@emotion/react` in deps | - |
| CSS Modules | `*.module.css` files | - |
| UnoCSS | `unocss` in devDeps | `uno.config.ts` |

### CI/CD Detection

| Platform | Indicator |
|----------|-----------|
| GitHub Actions | `.github/workflows/*.yml` |
| GitLab CI | `.gitlab-ci.yml` |
| CircleCI | `.circleci/config.yml` |
| Jenkins | `Jenkinsfile` |
| Travis CI | `.travis.yml` |
| Vercel | `vercel.json` |
| Netlify | `netlify.toml` |

## Detection Algorithm

```
1. Check for monorepo indicators first (nx.json, turbo.json, pnpm-workspace.yaml)
2. If monorepo, identify workspace packages
3. Check primary package manifest (package.json, Cargo.toml, etc.)
4. Detect language/runtime from manifest
5. Scan for framework config files
6. Check dependencies for frameworks
7. Detect build tools from devDependencies
8. Detect testing frameworks
9. Check for CI/CD configuration
10. Identify database from dependencies or config
```
