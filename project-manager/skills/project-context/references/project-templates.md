# Project Templates Reference

## Built-in Templates

### 1. react-vite

**Description**: Modern React setup with Vite, TypeScript, and Tailwind CSS

**Scaffold Commands**:
```bash
npm create vite@latest $PROJECT_NAME -- --template react-ts
cd $PROJECT_NAME
npm install
npm install -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p
npm install -D eslint eslint-plugin-react-hooks @typescript-eslint/eslint-plugin
npm install -D prettier eslint-config-prettier
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Post-setup Files**:
- `tailwind.config.js` - Configure content paths
- `src/index.css` - Add Tailwind directives
- `.eslintrc.cjs` - ESLint configuration
- `.prettierrc` - Prettier configuration
- `vitest.config.ts` - Test configuration

---

### 2. nextjs-app

**Description**: Next.js 14 with App Router, TypeScript, and Tailwind CSS

**Scaffold Command**:
```bash
npx create-next-app@latest $PROJECT_NAME \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

**Included by Default**:
- TypeScript
- Tailwind CSS
- ESLint
- App Router
- src/ directory

---

### 3. vue-vite

**Description**: Vue 3 with Vite, TypeScript, Pinia, and Vue Router

**Scaffold Commands**:
```bash
npm create vue@latest $PROJECT_NAME
# Select: TypeScript, Vue Router, Pinia, Vitest, ESLint, Prettier
cd $PROJECT_NAME
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

### 4. svelte-kit

**Description**: SvelteKit with TypeScript and Tailwind CSS

**Scaffold Commands**:
```bash
npm create svelte@latest $PROJECT_NAME
# Select: Skeleton project, TypeScript, ESLint, Prettier, Vitest
cd $PROJECT_NAME
npm install
npx svelte-add@latest tailwindcss
npm install
```

---

### 5. express-ts

**Description**: Express.js API with TypeScript, Prisma, and testing

**Scaffold Commands**:
```bash
mkdir $PROJECT_NAME && cd $PROJECT_NAME
npm init -y
npm install express cors helmet morgan dotenv
npm install -D typescript @types/node @types/express @types/cors @types/morgan
npm install -D ts-node-dev nodemon
npm install prisma @prisma/client
npm install -D vitest supertest @types/supertest
npx tsc --init
npx prisma init
```

**Directory Structure**:
```
$PROJECT_NAME/
├── src/
│   ├── index.ts
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── services/
│   └── utils/
├── prisma/
│   └── schema.prisma
├── tests/
├── .env.example
└── package.json
```

---

### 6. fastapi

**Description**: FastAPI with Python, SQLAlchemy, and Alembic

**Scaffold Commands**:
```bash
mkdir $PROJECT_NAME && cd $PROJECT_NAME
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install fastapi uvicorn[standard] sqlalchemy alembic python-dotenv
pip install pytest pytest-asyncio httpx
pip freeze > requirements.txt
```

**Directory Structure**:
```
$PROJECT_NAME/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── models/
│   ├── schemas/
│   ├── routers/
│   ├── services/
│   └── database.py
├── alembic/
├── tests/
├── .env.example
├── requirements.txt
└── alembic.ini
```

---

### 7. nestjs

**Description**: NestJS with TypeScript, TypeORM, and testing

**Scaffold Commands**:
```bash
npx @nestjs/cli new $PROJECT_NAME
cd $PROJECT_NAME
npm install @nestjs/typeorm typeorm pg
npm install @nestjs/config class-validator class-transformer
```

---

### 8. go-fiber

**Description**: Go API with Fiber and GORM

**Scaffold Commands**:
```bash
mkdir $PROJECT_NAME && cd $PROJECT_NAME
go mod init github.com/username/$PROJECT_NAME
go get github.com/gofiber/fiber/v2
go get gorm.io/gorm gorm.io/driver/postgres
go get github.com/joho/godotenv
```

**Directory Structure**:
```
$PROJECT_NAME/
├── cmd/
│   └── main.go
├── internal/
│   ├── handlers/
│   ├── models/
│   ├── services/
│   └── database/
├── pkg/
├── go.mod
├── go.sum
└── .env.example
```

---

### 9. t3-stack

**Description**: Full-stack T3 Stack (Next.js + tRPC + Prisma + Tailwind)

**Scaffold Command**:
```bash
npm create t3-app@latest $PROJECT_NAME
# Select: TypeScript, tRPC, Prisma, Tailwind, NextAuth (optional)
```

---

### 10. node-cli

**Description**: Node.js CLI tool with Commander and TypeScript

**Scaffold Commands**:
```bash
mkdir $PROJECT_NAME && cd $PROJECT_NAME
npm init -y
npm install commander chalk ora inquirer
npm install -D typescript @types/node @types/inquirer
npm install -D tsup vitest
npx tsc --init
```

**Package.json additions**:
```json
{
  "type": "module",
  "bin": {
    "$PROJECT_NAME": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --watch",
    "start": "node dist/index.js"
  }
}
```

---

### 11. rust-cli

**Description**: Rust CLI tool with Clap

**Scaffold Commands**:
```bash
cargo new $PROJECT_NAME
cd $PROJECT_NAME
cargo add clap --features derive
cargo add anyhow thiserror
cargo add tokio --features full  # if async needed
```

---

### 12. npm-package

**Description**: Publishable NPM package with TypeScript

**Scaffold Commands**:
```bash
mkdir $PROJECT_NAME && cd $PROJECT_NAME
npm init -y
npm install -D typescript tsup vitest @types/node
npx tsc --init
```

**Package.json structure**:
```json
{
  "name": "$PROJECT_NAME",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "test": "vitest",
    "prepublishOnly": "npm run build"
  }
}
```

---

### 13. monorepo-nx

**Description**: NX Monorepo with TypeScript

**Scaffold Command**:
```bash
npx create-nx-workspace@latest $PROJECT_NAME \
  --preset=ts \
  --packageManager=pnpm
```

---

## CLAUDE.md Template

All templates should include a CLAUDE.md:

```markdown
# Project: $PROJECT_NAME

## Overview
$DESCRIPTION

## Tech Stack
$TECH_STACK_LIST

## Getting Started

\`\`\`bash
$INSTALL_COMMAND
$DEV_COMMAND
\`\`\`

## Project Structure

\`\`\`
$DIRECTORY_STRUCTURE
\`\`\`

## Key Commands

| Command | Description |
|---------|-------------|
| `$DEV_COMMAND` | Start development server |
| `$BUILD_COMMAND` | Build for production |
| `$TEST_COMMAND` | Run tests |
| `$LINT_COMMAND` | Lint code |

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

| Variable | Description | Required |
|----------|-------------|----------|
$ENV_VARS_TABLE

## Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed

## Deployment

$DEPLOYMENT_INSTRUCTIONS
```

## Custom Template Creation

To create a custom template, add a directory to `~/.claude/project-templates/`:

```
~/.claude/project-templates/my-template/
├── template.json       # Template configuration
├── files/              # Files to copy
│   ├── CLAUDE.md
│   ├── .eslintrc.js
│   └── src/
│       └── index.ts
└── README.md           # Template documentation
```

### template.json Schema

```json
{
  "name": "my-template",
  "description": "My custom project template",
  "category": "fullstack",
  "techStack": ["typescript", "react", "express"],
  "scaffoldCommands": [
    "npm init -y",
    "npm install react express"
  ],
  "files": {
    "CLAUDE.md": "files/CLAUDE.md",
    "src/index.ts": "files/src/index.ts"
  },
  "variables": {
    "AUTHOR": {
      "prompt": "Author name",
      "default": ""
    },
    "DESCRIPTION": {
      "prompt": "Project description",
      "default": "A new project"
    }
  },
  "postSetup": [
    "git init",
    "npm install"
  ]
}
```
