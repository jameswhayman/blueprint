# BLUEPRINT

```
 ____  _    _   _ _____ ____  ____  ___ _   _ _____ 
| __ )| |  | | | | ____|  _ \|  _ \|_ _| \ | |_   _|
|  _ \| |  | | | |  _| | |_) | |_) || ||  \| | | |  
| |_) | |__| |_| | |___|  __/|  _ < | || |\  | | |  
|____/|_____\___/|_____|_|   |_| \_\___|_| \_| |_|  
```

> **Containerized Infrastructure Blueprint** - Production-ready web services with Caddy & Authelia

[![Version](https://img.shields.io/badge/version-1.2.6-blue.svg)](https://github.com/jameswhayman/blueprint)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

## Quick Start

```bash
# Install globally
npm install -g blueprint

# Create a new deployment
blueprint init --name my-app

# Start services
blueprint services start caddy
blueprint services start authelia
```

## Overview

Blueprint is a CLI tool for rapidly scaffolding secure, containerized web infrastructure using systemd containers (Podman). It provides a production-ready setup with:

- **Caddy** - Modern web server with automatic HTTPS
- **Authelia** - Complete authentication & authorization server with PostgreSQL backend
- **SMTP Integration** - Email notifications out of the box
- **File-based Secrets** - Secure secret management

## Features

- **Zero-config HTTPS** - Automatic SSL certificates via Caddy
- **Single Sign-On (SSO)** - Centralized authentication
- **Multi-Factor Auth (MFA)** - TOTP 2FA support
- **Socket Activation** - Efficient resource usage
- **Modular Architecture** - Easy to extend and customize
- **Production Ready** - Security best practices built-in

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

### Initialize Deployment
```bash
blueprint init --name my-app --directory ./my-deployment
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

### Authentication Management
```bash
# Add users
blueprint auth add-user --username john --email john@example.com

# List users
blueprint auth list-users
```

### Domain Management
```bash
# Add domain routing
blueprint domain add --domain app.example.com --target http://localhost:3000

# List domains
blueprint domain list
```

### Secrets Management
```bash
# Setup secrets
blueprint secrets setup

# View secrets (for debugging)
blueprint secrets show
```

## Architecture

```
my-deployment/
├── containers/           # Container definitions
│   ├── *.container      # systemd container units
│   ├── *.volume         # Volume definitions
│   ├── Caddyfile        # Caddy configuration
│   └── authelia-config/ # Authelia configuration
├── secrets/             # Secret files (git-ignored)
│   └── *.secret        # Individual secret files
└── user/               # User systemd units
    └── *.socket        # Socket activation units
```

## Service Startup Order

1. `authelia` - Authentication service (automatically starts its PostgreSQL database)
2. `caddy` - Web server (depends on socket activation)

## systemd Management

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

- **File-based secrets** with 600 permissions
- **Argon2id password hashing**
- **Rate limiting** and brute-force protection
- **Secure session management**
- **TLS 1.2+ enforcement**
- **HTTPS-only by default**

## Configuration

The CLI uses modular templates for easy customization:

- `src/templates/systemd/` - Container unit templates
- `src/templates/config/` - Application config templates
- `src/services/` - Service management logic

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - See [LICENSE](LICENSE) for details

## Links

- [GitHub Repository](https://github.com/jameswhayman/blueprint)
- [Issue Tracker](https://github.com/jameswhayman/blueprint/issues)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [Authelia Documentation](https://www.authelia.com/docs/)

---

Built with Node.js and TypeScript