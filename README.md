# BLUEPRINT

```
 ____  _    _   _ _____ ____  ____  ___ _   _ _____ 
| __ )| |  | | | | ____|  _ \|  _ \|_ _| \ | |_   _|
|  _ \| |  | | | |  _| | |_) | |_) || ||  \| | | |  
| |_) | |__| |_| | |___|  __/|  _ < | || |\  | | |  
|____/|_____\___/|_____|_|   |_| \_\___|_| \_| |_|  
```

> **Opinionated Self-Hosting Platform** - Deploy a complete stack of open-source services with built-in authentication and HTTPS

[![Version](https://img.shields.io/badge/version-1.2.10-blue.svg)](https://github.com/jameswhayman/blueprint)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

## Vision

Blueprint is an opinionated deployment tool for self-hosting enthusiasts who want to run their own services without the complexity of configuring authentication, reverse proxies, and containerization from scratch.

Every service deployed with Blueprint:
- ✅ Routes through **Caddy** (automatic HTTPS, subdomains)
- ✅ Protected by **Authelia** (Single Sign-On, 2FA)
- ✅ Runs as **systemd containers** (Podman)
- ✅ Shares **unified secret management**
- ✅ Follows **production-ready defaults**

## Quick Start

```bash
# Install globally
npm install -g blueprint

# Create a new deployment
blueprint init --name my-platform

# Automatically set up systemd links and start services
# (Blueprint will prompt to do this during init)

# Or manually start core services
blueprint services start authelia-postgres authelia caddy

# Add verbose logging for debugging
blueprint -v services logs authelia
```

## Core Infrastructure

Blueprint provides an opinionated stack with two essential services that power everything else:

### 🔒 Caddy (Reverse Proxy)
- Automatic HTTPS with Let's Encrypt
- Subdomain routing for all services
- Zero-config SSL certificates
- Modern HTTP/3 support

### 🛡️ Authelia (Authentication/Authorization)
- Single Sign-On (SSO) for all services
- Multi-factor authentication (TOTP 2FA)
- User and group management
- Session management across services
- PostgreSQL backend (auto-configured)
- Advanced secret management with podman integration

## Features

- **Zero Decision Fatigue** - Authentication, routing, and containerization are pre-configured
- **Production Ready** - Security best practices and sensible defaults built-in
- **Consistent Patterns** - Every service follows the same deployment model
- **Easy Scaling** - Add new services with a single command
- **Unified Management** - One tool to control your entire self-hosted infrastructure
- **Advanced Secret Management** - Integrated podman secrets with mixed file-based and environment variable approaches

## Installation

### Global Installation (Recommended)
```bash
npm install -g blueprint
```

### Development Setup
```bash
git clone https://github.com/jameswhayman/blueprint.git
cd blueprint
npm install
npm run build
npm run link  # For development
```

## CLI Commands

### Initialize Platform
```bash
blueprint init --name my-platform --domain example.com
```

### Service Management
```bash
# List all services
blueprint services list

# Start/stop/restart services
blueprint services start <service>
blueprint services stop <service>
blueprint services restart <service>

# View logs
blueprint services logs <service> -f
```

### User Management
```bash
# Add users to your platform
blueprint auth add-user --username john --email john@example.com

# List platform users
blueprint auth list-users
```

### Domain Routing
```bash
# Route subdomain to a service
blueprint domain add --domain app.example.com --target http://localhost:3000

# List configured domains
blueprint domain list
```

### Secrets Management
```bash
# Interactive setup for platform secrets
blueprint secrets setup

# View current secrets (debugging)
blueprint secrets show
```

## Architecture

When you initialize a Blueprint deployment, it creates:

```
my-platform/
├── containers/           # Container definitions
│   ├── *.container      # systemd container units
│   ├── *.volume         # Volume definitions
│   ├── Caddyfile        # Caddy routing configuration
│   └── authelia-config/ # Authelia configuration
├── backups/             # Automatic backups during setup
└── user/               # User systemd units
    └── *.socket        # Socket activation units
```

## systemd Management

Blueprint uses systemd containers (Podman) for orchestration:

```bash
# Start services (as user, not root)
systemctl --user start caddy.container
systemctl --user start authelia.container

# Enable auto-start on boot
systemctl --user enable caddy.container
systemctl --user enable authelia.container

# View logs
journalctl --user -u caddy.container -f
```

## Security Features

- **Podman secret management** with mixed file-based and environment variable approaches
- **Argon2id password hashing** for user credentials
- **Rate limiting** and brute-force protection
- **Secure session management** with automatic expiry
- **TLS 1.2+ enforcement** for all communications
- **HTTPS-only by default** with automatic certificate management
- **Automatic certificate renewal** via Let's Encrypt
- **Container isolation** with systemd security features

## Recent Updates (v1.2.10)

🔧 **Major Authelia Configuration Overhaul**
- Fixed all Authelia configuration issues and startup errors
- Implemented proper secret management with podman integration
- Updated networking from pasta to podman bridge for inter-container communication
- Streamlined deployment structure (removed unnecessary secrets directory)
- Added verbose mode (`-v`) for detailed debugging output
- Automatic deployment setup during initialization

🛠️ **Technical Improvements**
- Mixed secret approach: file-based for sensitive data, environment variables for configuration
- Reduced secret count from 11 to 10 optimized secrets
- Fixed container networking for proper hostname resolution
- Updated to latest Authelia 4.39+ environment variable format
- Removed deprecated configuration options

## Roadmap

### Coming Soon: Service Marketplace

Blueprint will support one-command deployment of popular self-hosted services:

#### TODO: Services to Add
- [ ] **Listmonk** - Newsletter and mailing list manager
- [ ] **Twenty CRM** - Modern CRM alternative to Salesforce
- [ ] **Umami** - Privacy-focused analytics alternative to Google Analytics
- [ ] **OpenReplay** - Session replay and debugging platform

#### Future Services
- [ ] **Nextcloud** - File sync and collaboration
- [ ] **GitLab** - Complete DevOps platform
- [ ] **Grafana** - Monitoring and observability
- [ ] **Vaultwarden** - Password manager
- [ ] **Jellyfin** - Media server
- [ ] **PhotoPrism** - AI-powered photo management
- [ ] **Paperless-ngx** - Document management
- [ ] **Home Assistant** - Home automation

Each service will be pre-configured to work seamlessly with Caddy and Authelia, requiring minimal configuration from the user.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Adding a New Service

To add a new service to Blueprint:
1. Create a service template in `src/templates/services/`
2. Add the service configuration generator in `src/services/`
3. Register the service in the CLI commands
4. Submit a PR with your addition

## License

MIT License - See [LICENSE](LICENSE) for details

## Links

- [GitHub Repository](https://github.com/jameswhayman/blueprint)
- [Issue Tracker](https://github.com/jameswhayman/blueprint/issues)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [Authelia Documentation](https://www.authelia.com/docs/)

---

Built with Node.js and TypeScript