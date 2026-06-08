# 🤝 Contributing to Brix V2

Thank you for your interest in contributing to Brix V2! This guide will help you get started with contributing to the project.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [How to Contribute](#how-to-contribute)
5. [Coding Standards](#coding-standards)
6. [Commit Guidelines](#commit-guidelines)
7. [Pull Request Process](#pull-request-process)
8. [Issue Guidelines](#issue-guidelines)
9. [Community](#community)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in your interactions.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Harassment, trolling, or discriminatory comments
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 18.x or higher
- npm or yarn
- Git
- A GitHub account
- Basic knowledge of:
  - React and Next.js
  - TypeScript
  - Tailwind CSS
  - SQL and databases

### First-Time Contributors

If you're new to open source, here are some good first issues:

1. Documentation improvements
2. Bug fixes with clear reproduction steps
3. UI/UX enhancements
4. Test coverage improvements

Look for issues labeled `good-first-issue` or `help-wanted`.

---

## Development Setup

### 1. Fork the Repository

Click the "Fork" button on GitHub to create your own copy of the repository.

### 2. Clone Your Fork

```bash
git clone https://github.com/Brixsport/BrixSports.git
cd BrixSports
```

### 3. Add Upstream Remote

```bash
git remote add upstream https://github.com/Brixsport/BrixSports.git
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Set Up Environment

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

### 6. Initialize Database

```bash
npm run db:push
```

### 7. Start Development Server

```bash
npm run dev
```

---

## How to Contribute

### Reporting Bugs

Before creating a bug report:

1. **Check existing issues** to avoid duplicates
2. **Use the latest version** to ensure the bug still exists
3. **Collect information** about your environment

**Bug Report Template:**

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected behavior**
A clear description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. Windows 11]
 - Browser: [e.g. Chrome 120]
 - Node Version: [e.g. 18.17.0]
 - Version: [e.g. 1.0.0]

**Additional context**
Add any other context about the problem here.
```

### Suggesting Features

**Feature Request Template:**

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request.
```

### Contributing Code

1. **Find or create an issue** describing what you'll work on
2. **Comment on the issue** to let others know you're working on it
3. **Create a feature branch** from `main`
4. **Make your changes** following our coding standards
5. **Test your changes** thoroughly
6. **Submit a pull request**

---

## Coding Standards

### TypeScript

- **Use TypeScript** for all new code
- **Define types** for all function parameters and return values
- **Avoid `any`** - use proper types or `unknown`
- **Use interfaces** for object shapes
- **Export types** that are used in multiple files

**Example:**

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): Promise<User> {
  // ...
}

// ❌ Bad
function getUser(id: any): any {
  // ...
}
```

### React Components

- **Use functional components** with hooks
- **Use TypeScript** for prop types
- **Keep components small** and focused
- **Extract reusable logic** into custom hooks
- **Use meaningful names** for components and props

**Example:**

```typescript
// ✅ Good
interface MatchCardProps {
  match: Match;
  onSelect: (matchId: string) => void;
}

export function MatchCard({ match, onSelect }: MatchCardProps) {
  return (
    <div onClick={() => onSelect(match.id)}>
      {/* ... */}
    </div>
  );
}

// ❌ Bad
export function Card(props: any) {
  return <div onClick={() => props.onClick(props.data.id)} />;
}
```

### Styling

- **Use Tailwind CSS** for all styling
- **Follow mobile-first** approach
- **Use design system colors** from tailwind.config
- **Avoid inline styles** unless absolutely necessary
- **Use responsive classes** for different screen sizes

**Example:**

```tsx
// ✅ Good
<div className="flex flex-col gap-4 p-4 bg-slate-900 rounded-xl md:flex-row md:gap-6 md:p-6">
  {/* ... */}
</div>

// ❌ Bad
<div style={{ display: 'flex', padding: '16px', backgroundColor: '#0f172a' }}>
  {/* ... */}
</div>
```

### File Organization

- **Group related files** together
- **Use index files** for clean imports
- **Keep files focused** - one component per file
- **Use meaningful names** for files and folders

**Structure:**

```
components/
├── lineup/
│   ├── InteractivePitch.tsx
│   ├── FormationSelector.tsx
│   ├── PlayerPool.tsx
│   └── index.ts
```

### Naming Conventions

- **Components**: PascalCase (`MatchCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useMatches.ts`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_PLAYERS`)
- **Types/Interfaces**: PascalCase (`Match`, `UserProfile`)

### Comments

- **Write self-documenting code** when possible
- **Add comments** for complex logic
- **Use JSDoc** for public APIs
- **Explain WHY**, not WHAT

**Example:**

```typescript
// ✅ Good
/**
 * Calculates prediction points based on accuracy and confidence.
 * Higher confidence increases potential points but also increases risk.
 */
function calculatePoints(prediction: Prediction, actual: Score): number {
  // Exact score match gets bonus points
  if (prediction.homeScore === actual.homeScore && 
      prediction.awayScore === actual.awayScore) {
    return BASE_POINTS + (prediction.confidence * CONFIDENCE_MULTIPLIER);
  }
  // ...
}

// ❌ Bad
// Calculate points
function calc(p: any, a: any): number {
  // Check if scores match
  if (p.h === a.h && p.a === a.a) {
    return 10 + (p.c * 0.5);
  }
}
```

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

### Scope (Optional)

The scope should be the name of the affected module:

- `api`
- `ui`
- `database`
- `auth`
- `predictions`
- `livestream`
- etc.

### Subject

- Use imperative, present tense: "add" not "added" or "adds"
- Don't capitalize first letter
- No period at the end
- Maximum 50 characters

### Body (Optional)

- Use imperative, present tense
- Include motivation for the change
- Contrast with previous behavior

### Footer (Optional)

- Reference issues: `Closes #123`
- Breaking changes: `BREAKING CHANGE: description`

### Examples

```bash
# Simple feature
feat(predictions): add confidence slider to prediction form

# Bug fix with body
fix(api): resolve race condition in match updates

The previous implementation didn't properly handle concurrent
updates to match scores, causing occasional data inconsistencies.

Closes #456

# Breaking change
feat(auth)!: migrate to NextAuth v5

BREAKING CHANGE: Authentication configuration has changed.
Update your .env file with new NextAuth variables.

# Multiple changes
feat(ui): improve match card responsiveness

- Add mobile-first responsive classes
- Optimize image loading
- Improve accessibility with ARIA labels

Closes #789
```

---

## Pull Request Process

### Before Submitting

1. **Update your branch** with latest `main`:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests and linting**:
   ```bash
   npm run lint
   npm run build
   ```

3. **Test your changes** manually

4. **Update documentation** if needed

### PR Title

Follow the same format as commit messages:

```
feat(predictions): add leaderboard filtering
```

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues
Closes #123

## Changes Made
- Change 1
- Change 2
- Change 3

## Screenshots (if applicable)
Add screenshots to demonstrate the changes.

## Testing
Describe how you tested your changes:
- [ ] Tested on desktop
- [ ] Tested on mobile
- [ ] Tested with different browsers
- [ ] Added/updated tests

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have tested my changes
```

### Review Process

1. **Automated checks** must pass (linting, build)
2. **At least one approval** from a maintainer
3. **All conversations resolved**
4. **No merge conflicts**

### After Approval

- Maintainers will merge your PR
- Your branch will be deleted
- Changes will be deployed

---

## Issue Guidelines

### Creating Issues

**Good Issue:**
- Clear, descriptive title
- Detailed description
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Environment information
- Screenshots/videos if applicable

**Bad Issue:**
- Vague title: "It doesn't work"
- No details: "Fix the bug"
- No context or reproduction steps

### Issue Labels

- `bug`: Something isn't working
- `feature`: New feature request
- `enhancement`: Improvement to existing feature
- `documentation`: Documentation improvements
- `good-first-issue`: Good for newcomers
- `help-wanted`: Extra attention needed
- `priority-high`: High priority
- `priority-low`: Low priority
- `wontfix`: This will not be worked on

---

## Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Pull Requests**: Code contributions

### Getting Help

If you need help:

1. Check the [documentation](./DEVELOPER_ONBOARDING.md)
2. Search existing issues
3. Ask in GitHub Discussions
4. Create a new issue with the `question` label

### Recognition

Contributors will be:
- Listed in the project's contributors
- Mentioned in release notes
- Credited in the documentation

---

## Development Tips

### Useful Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Fix linting issues
npm run lint -- --fix

# Open database GUI
npm run db:studio

# Generate database migrations
npm run db:generate

# Push schema changes
npm run db:push
```

### Debugging

- Use browser DevTools for frontend debugging
- Check server logs in terminal
- Use `console.log` strategically (remove before committing)
- Use VS Code debugger for complex issues

### Performance

- Use Next.js Image component for images
- Implement proper loading states
- Use React.memo for expensive components
- Optimize database queries
- Implement pagination for large lists

---

## License

By contributing to Brix V2, you agree that your contributions will be licensed under the same license as the project.

---

## Questions?

If you have questions about contributing, feel free to:

- Open a GitHub Discussion
- Create an issue with the `question` label
- Reach out to the maintainers

---

**Thank you for contributing to Brix V2! 🎉**

Last Updated: January 4, 2026
