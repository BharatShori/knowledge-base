# QE Knowledge Base — V1

## 1. Project Overview

Build a local-first web application that acts as my personal Software Engineering / Quality Engineering knowledge base.

The purpose of the application is to allow me to quickly:

- Add technical topics and terms.
- Organise topics into categories.
- Search for topics.
- Browse topics using the left-hand navigation.
- Read detailed notes.
- Edit existing topics.
- Delete topics.
- Add tags.
- See related topics.

Typical topics may include:

- Playwright
- Appium
- Selenium
- REST API
- GraphQL
- OAuth 2.0
- JWT
- API Gateway
- MCP
- RAG
- Agentic AI
- DORA Metrics
- Shift Left
- TDD
- CI/CD
- Contract Testing
- Microservices
- k6
- Performance Testing

This is a personal application and will initially run entirely on my local Mac.

The priority is:

1. Simple
2. Fast
3. Clean
4. Reliable
5. Easy to extend

Do not over-engineer the application.

---

# 2. Technology Stack

Use:

- TypeScript
- Next.js
- React
- Next.js App Router
- Tailwind CSS
- shadcn/ui
- Prisma ORM
- SQLite
- Zod
- Vitest
- Playwright
- npm

Use TypeScript strict mode.

The application should run locally at:

http://localhost:3000

---

# 3. Architecture

Use a single Next.js application.

Architecture:

Browser
↓
React / Next.js
↓
Server Actions / Route Handlers
↓
Prisma
↓
SQLite

Do NOT create a separate backend application.

Do NOT introduce:

- NestJS
- Express
- MongoDB
- PostgreSQL
- Redis
- Elasticsearch
- Vector databases
- Docker
- Kubernetes
- Authentication
- Cloud infrastructure

These may be considered in future versions but are NOT part of V1.

---

# 4. V1 Scope

V1 consists of:

### Required

1. Dashboard
2. Left navigation
3. Categories
4. Topics
5. Topic creation
6. Topic editing
7. Topic deletion
8. Topic viewing
9. Search
10. Tags
11. Related topics
12. Sources
13. SQLite persistence
14. Basic validation
15. Unit tests
16. Playwright end-to-end tests

### Not included in V1

Do NOT implement:

- AI
- Semantic search
- Vector search
- Chat with knowledge base
- AI-generated summaries
- AI-generated tags
- AI-generated interview questions
- File import
- File export
- Inbox
- Spaced repetition
- Quiz mode
- Authentication
- Cloud synchronisation
- Mobile application
- Browser extension

---

# 5. User Interface

Use a desktop-first layout.

The primary layout should be:

```text
┌───────────────────────────────────────────────────────────────┐
│ QE Knowledge Base     Search...                    + Add Topic │
├───────────────────┬───────────────────────────────────────────┤
│                   │                                           │
│ CATEGORIES        │                                           │
│                   │              Main Content                 │
│ AI & GenAI        │                                           │
│ API               │                                           │
│ Automation        │                                           │
│ CI/CD             │                                           │
│ Performance       │                                           │
│ Mobile            │                                           │
│ Security          │                                           │
│ Architecture     │                                           │
│ Testing           │                                           │
│                   │                                           │
│ ALL TOPICS        │                                           │
│                   │                                           │
│ Playwright        │                                           │
│ Appium            │                                           │
│ REST API          │                                           │
│ MCP               │                                           │
│ ...               │                                           │
└───────────────────┴───────────────────────────────────────────┘
```

The left navigation should remain visible on desktop.

Use a clean professional UI.

Avoid excessive visual decoration.

---

# 6. Dashboard

Create a simple dashboard as the home page.

Display:

- Total Topics
- Total Categories
- Total Tags
- Recently Added Topics

Example:

```text
QE Knowledge Base

Topics       Categories       Tags
127          10               83

Recently Added
─────────────────────────────
Playwright MCP
Agentic AI
DORA Metrics
Contract Testing
```

Do not add charts or complex analytics in V1.

---

# 7. Categories

Create predefined initial categories:

- AI & GenAI
- API
- Automation
- CI/CD
- Cloud
- Databases
- DevOps
- Mobile Testing
- Performance Testing
- Security
- Software Architecture
- Software Testing
- Agile / Delivery
- General

Categories should be stored in SQLite.

A Topic belongs to one Category.

The application should allow:

- Viewing categories
- Adding categories
- Editing categories
- Deleting categories

Do not allow deletion of a category if it contains topics unless the user first moves those topics to another category.

---

# 8. Topics

A Topic is the main knowledge entity.

Use the following fields:

```text
id
title
slug
summary
content
categoryId
createdAt
updatedAt
```

Rules:

- `title` is required.
- `summary` is optional.
- `content` is optional.
- `categoryId` is required.
- `slug` should be generated automatically.
- `createdAt` and `updatedAt` should be managed automatically.

Example:

```text
Title:
Playwright

Summary:
Modern browser automation and end-to-end testing framework.

Category:
Automation

Content:

Playwright is a browser automation framework...

Key Concepts
- Browser
- Browser Context
- Page
- Locator
- Fixtures
- APIRequestContext
```

---

# 9. Topic Viewer

When a topic is selected, display:

```text
Playwright

Automation

Modern browser automation and end-to-end
testing framework.

────────────────────────────────────

Detailed Notes

...

────────────────────────────────────

Tags

TypeScript   Automation   E2E

────────────────────────────────────

Related Topics

Playwright Fixtures
APIRequestContext
Browser Context

────────────────────────────────────

Sources

Official Playwright Documentation
```

Provide:

- Edit button
- Delete button

The viewer should be easy to read.

---

# 10. Topic Editor

Create a form for adding and editing topics.

Fields:

### Title

Required.

### Category

Required dropdown.

### Summary

Optional.

### Content

Optional.

### Tags

Allow multiple tags.

### Related Topics

Allow selecting existing topics.

### Sources

Allow adding:

- Source title
- URL

Use Zod for validation.

The user should be able to save or cancel.

---

# 11. Quick Add

The primary action should be:

```text
+ Add Topic
```

The goal is very low friction.

Minimum input:

```text
Title
Category
```

Everything else should be optional.

After saving, navigate directly to the newly created topic.

---

# 12. Search

Implement local database search.

Search across:

- Topic title
- Summary
- Content
- Tags
- Category

Support partial matching.

Examples:

Searching:

```text
browser
```

should find topics such as:

```text
Playwright
Selenium
BrowserStack
Browser Context
```

Searching:

```text
API
```

should find:

```text
REST API
GraphQL
API Gateway
REST Assured
Postman
```

The search should return results quickly.

Display:

```text
Search Results

Playwright
Automation
Modern browser automation...

APIRequestContext
Automation
Playwright API testing...

Browser Context
Automation
Isolated browser session...
```

Clicking a result should open the topic.

---

# 13. Tags

Topics can have multiple tags.

Examples:

```text
Playwright

TypeScript
Automation
E2E
API Testing
CI/CD
```

Tags should be reusable entities.

A tag should not be duplicated if it already exists.

Allow:

- Adding tags
- Removing tags
- Browsing topics by tag

---

# 14. Related Topics

Topics can have relationships with other topics.

Example:

```text
Playwright

Related Topics:

Playwright Fixtures
APIRequestContext
Browser Context
Page Object Model
Parallel Testing
Sharding
```

Store these relationships in the database.

Do not simply store related topic names as text.

A relationship should connect two Topic records.

Avoid duplicate relationships.

---

# 15. Sources

A Topic can have zero or more sources.

Each source should contain:

```text
id
topicId
title
url
```

Example:

```text
Playwright

Sources

Official Playwright Documentation
https://...

GitHub Repository
https://...
```

URLs should be validated as URLs.

Do not automatically scrape or retrieve the source.

---

# 16. Database

Use Prisma + SQLite.

Create these models:

```text
Category
Topic
Tag
TopicTag
TopicRelation
Source
```

Conceptually:

```text
Category
   │
   └── Topic
          │
          ├── Tags
          ├── Related Topics
          └── Sources
```

Use appropriate foreign keys and indexes.

Use Prisma migrations.

Do not manually write SQL unless Prisma cannot reasonably perform the required operation.

---

# 17. Prisma Schema

Create a clean Prisma schema.

The exact implementation can be determined during Milestone 1, but it should support:

### Category

- id
- name
- description
- createdAt
- updatedAt

### Topic

- id
- title
- slug
- summary
- content
- categoryId
- createdAt
- updatedAt

### Tag

- id
- name
- createdAt

### TopicTag

Many-to-many relationship between Topic and Tag.

### TopicRelation

Many-to-many self relationship between Topic records.

### Source

- id
- topicId
- title
- url
- createdAt

Add indexes for fields commonly used for lookup/search.

---

# 18. Zod Validation

Use Zod at application boundaries.

Examples:

Topic creation:

```text
title → required string
summary → optional string
content → optional string
categoryId → required valid identifier
```

Source:

```text
title → required string
url → valid URL
```

Do not rely solely on frontend validation.

Validate data on the server as well.

---

# 19. Markdown

Topic content should support basic Markdown formatting.

The following should work:

```text
# Heading

## Key Concepts

- Item 1
- Item 2

**Important**

`code`

```

Use a well-supported Markdown renderer if needed.

Do not allow unsafe HTML execution.

---

# 20. Error Handling

Provide clear user-facing errors.

Examples:

- Topic title is required.
- Category is required.
- Category cannot be deleted because it contains topics.
- Topic could not be saved.
- Topic could not be deleted.
- Invalid source URL.

Do not expose stack traces or internal database errors to the user.

Log useful technical information during development.

---

# 21. Empty States

Handle empty states properly.

Examples:

No topics:

```text
No topics yet.

Add your first knowledge topic.

[ + Add Topic ]
```

No search results:

```text
No topics found for "xyz".

Try another search term.
```

No related topics:

```text
No related topics.
```

---

# 22. Loading States

Provide appropriate loading indicators when necessary.

Avoid unnecessary loading spinners for operations that are effectively instantaneous.

Use skeletons or simple loading states where appropriate.

---

# 23. Accessibility

Use semantic HTML.

Ensure:

- Buttons have accessible names.
- Form fields have labels.
- Keyboard navigation works.
- Focus states are visible.
- Dialogs can be operated using keyboard.
- Colour is not the only method of communicating information.

Prefer shadcn/ui accessible components where appropriate.

---

# 24. Keyboard Shortcuts

Implement only these initial shortcuts:

```text
/          Focus search
n          Create new topic
Escape     Close dialog
```

On macOS and Windows, use appropriate conventions.

Do not interfere with normal browser shortcuts.

---

# 25. Testing

This project is also intended to demonstrate good Quality Engineering practices.

## Unit Testing

Use Vitest.

Test:

- Zod validation
- slug generation
- search/filter logic
- utility functions

## End-to-End Testing

Use Playwright.

Create tests for:

### Topic

- Create topic
- View topic
- Edit topic
- Delete topic

### Search

- Search by title
- Search by content
- Search by tag
- No-result search

### Category

- Navigate by category
- Create category
- Edit category
- Delete empty category
- Prevent deletion of category containing topics

### Tags

- Add tag
- Remove tag
- Browse by tag

### Related Topics

- Create relationship
- Display related topic
- Remove relationship

### Sources

- Add source
- Remove source
- Validate URL

---

# 26. Test Data

Create predictable test data for automated tests.

Do not make tests dependent on whatever happens to exist in the user's personal database.

Tests should be repeatable.

Prefer accessible locators:

```text
getByRole()
getByLabel()
getByText()
```

Avoid brittle CSS selectors.

---

# 27. Code Organisation

Use a sensible structure similar to:

```text
src/
  app/
    page.tsx
    topics/
    categories/
    tags/
    ...
  components/
    layout/
    topics/
    categories/
    tags/
    ui/
  lib/
    db/
    validation/
    utils/
  actions/
  types/

prisma/
  schema.prisma
  migrations/

tests/
  e2e/
  unit/
```

The exact structure can be adjusted if Next.js conventions make another organisation cleaner.

Do not create unnecessary folders.

---

# 28. Development Process

Build the application incrementally.

Do not generate the whole application in one step.

Use these milestones.

## Milestone 1 — Project Foundation

Implement:

- Next.js
- TypeScript
- Tailwind
- shadcn/ui
- Prisma
- SQLite
- database schema
- initial migration
- basic application layout
- basic navigation

Verify:

```bash
npm run dev
```

works.

---

## Milestone 2 — Categories and Topics

Implement:

- Category CRUD
- Topic CRUD
- Topic viewer
- Topic editor
- Dashboard

Add unit and E2E tests.

---

## Milestone 3 — Search and Navigation

Implement:

- Left navigation
- Category filtering
- Topic list
- Search
- Search results
- Tag filtering

Add tests.

---

## Milestone 4 — Relationships

Implement:

- Tags
- Related Topics
- Sources

Add tests.

---

## Milestone 5 — Polish

Improve:

- UI consistency
- Accessibility
- Error handling
- Loading states
- Empty states
- Keyboard shortcuts
- Responsive behaviour

Run the complete test suite.

---

# 29. Git

Use Git from the beginning.

Create logical commits.

Examples:

```text
chore: initialise Next.js project
feat: add Prisma and SQLite
feat: add category management
feat: add topic CRUD
feat: add topic search
feat: add tags
feat: add related topics
test: add topic e2e tests
test: add search tests
```

Do not make one huge commit containing the entire application.

---

# 30. Important Claude Code Rules

These rules are mandatory.

### Rule 1 — Don't over-engineer

Prefer the simplest solution that satisfies the requirement.

### Rule 2 — Don't add dependencies casually

Before adding a new dependency, explain:

- Why it is needed.
- What problem it solves.
- Whether the requirement can be implemented without it.

### Rule 3 — Don't change architecture unnecessarily

Do not introduce additional frameworks or services without explicit approval.

### Rule 4 — Test changes

After implementing a feature:

1. Run relevant unit tests.
2. Run relevant Playwright tests.
3. Fix failures.
4. Verify the application manually where appropriate.

### Rule 5 — Keep changes focused

Do not modify unrelated code while implementing a feature.

### Rule 6 — Explain before major changes

Before each milestone, briefly explain:

- What will be implemented.
- Which files will be created/modified.
- Any architectural decisions.

Then implement.

### Rule 7 — Don't assume requirements

If an implementation decision materially affects the architecture or user experience, ask before making the decision.

For minor implementation decisions, choose the simplest sensible option.

### Rule 8 — Keep V1 bounded

Do not implement features listed under "Future Features" unless explicitly requested.

---

# 31. Future Features

The following may be added after V1:

- AI summarisation
- AI explanations
- AI-generated examples
- AI-generated interview questions
- AI-generated tags
- AI-generated categories
- AI-suggested related topics
- Semantic search
- Vector database
- RAG
- Chat with knowledge base
- Import from Markdown/PDF/Word
- Export
- Inbox
- Review reminders
- Spaced repetition
- Interview mode
- Quiz mode
- Browser extension
- PWA
- Cloud synchronisation
- Authentication
- PostgreSQL

The V1 architecture should not prevent these features from being added later, but do not build infrastructure for them now.

---

# 32. First Action

Before writing application code:

1. Review this specification.
2. Identify any ambiguities.
3. Propose the project directory structure.
4. Propose the Prisma schema.
5. List the minimum npm dependencies.
6. Explain the Milestone 1 implementation plan.
7. Wait for approval before implementing Milestone 1.

Do not implement the application before completing this planning step.
