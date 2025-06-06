# Contributing to Alicia Document Assistant

First off, thank you for considering contributing to Alicia! It's people like you that make Alicia such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by the [Alicia Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps which reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include screenshots if possible

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* Use a clear and descriptive title
* Provide a step-by-step description of the suggested enhancement
* Provide specific examples to demonstrate the steps
* Describe the current behavior and explain which behavior you expected to see instead
* Explain why this enhancement would be useful

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Process

1. Clone the repository
   ```bash
   git clone https://github.com/anubissbe/alicia-document-assistant.git
   cd alicia-document-assistant
   ```

2. Install dependencies
   ```bash
   cd web-app
   npm install
   ```

3. Start the development server
   ```bash
   npm start
   ```

4. Make your changes
   - Follow the existing code style
   - Write clear commit messages
   - Add tests if applicable
   - Update documentation

5. Run tests and linting
   ```bash
   npm run lint
   npm test
   ```

## Styleguides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

### JavaScript Styleguide

* All JavaScript must adhere to the ESLint configuration
* Use ES6+ features where appropriate
* Prefer `const` over `let`, and never use `var`
* Use meaningful variable names
* Add comments for complex logic

### Documentation Styleguide

* Use Markdown for documentation
* Reference functions and classes in backticks: \`functionName()\`
* Include code examples where helpful

## Community

* Join our [Discussions](https://github.com/anubissbe/alicia-document-assistant/discussions)
* Follow our [Blog](https://github.com/anubissbe/alicia-document-assistant/wiki)
* Chat with us on [Discord](https://discord.gg/alicia) (coming soon)

## Recognition

Contributors will be recognized in our README.md file. We value every contribution, big or small!

Thank you for contributing to Alicia! 🎉