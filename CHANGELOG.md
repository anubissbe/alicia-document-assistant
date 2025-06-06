# Changelog

All notable changes to Alicia Document Assistant will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Docker containerization with Ollama support (in progress)
- Community standard files (CONTRIBUTING, CODE_OF_CONDUCT, etc.)
- Additional GitHub workflows for better CI/CD

### Changed
- Prioritized Docker/Ollama integration in roadmap
- Improved repository structure for community standards

## [1.0.0] - 2024-01-06

### Added
- Initial release of Alicia Document Assistant web application
- AI-powered document generation using LM Studio
- Multiple document format support (DOCX, PDF, HTML, Markdown)
- Real-time document preview
- Document templates (Business Letter, Technical HLD)
- Export functionality for all supported formats
- Dark mode support
- Auto-save functionality
- Document statistics tracking
- Keyboard shortcuts
- Version history
- Print preview
- Image generation with Stable Diffusion
- Research assistant features
- MCP (Model Context Protocol) server
- Responsive design for mobile devices

### Security
- Input sanitization
- XSS protection
- Secure file handling
- Environment variable support for sensitive data

### Infrastructure
- GitHub Actions CI/CD pipelines
- ESLint configuration
- Deployment scripts for multiple platforms
- Analytics server for usage tracking

## [0.9.0] - 2024-01-05 (Pre-release)

### Added
- VS Code extension prototype (later removed)
- Initial web application framework
- Basic document generation features
- Template system foundation

### Changed
- Pivoted from VS Code extension to standalone web application
- Simplified architecture for better maintainability

### Removed
- VS Code extension code and dependencies
- Extension-specific documentation

## Future Releases

### [1.1.0] - Planned
- Complete Docker/Ollama integration
- User authentication system
- Cloud storage support
- Enhanced security features

### [1.2.0] - Planned
- Real-time collaboration
- Template marketplace
- Advanced AI features
- Performance optimizations

### [2.0.0] - Planned
- Enterprise features
- Plugin system
- Mobile applications
- Advanced integrations

---

For a detailed roadmap, see [Todo.md](Todo.md)