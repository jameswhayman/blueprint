# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a containerized web infrastructure blueprint using systemd containers (Podman) for orchestration. It provides a secure web server setup with authentication using Caddy and Authelia.

## Key Technologies

- **Caddy**: Web server with automatic HTTPS
- **Authelia**: Authentication and authorization server  
- **systemd containers**: Container orchestration (not Docker Compose)
- **PostgreSQL**: Database backend for Authelia (external dependency)

## Architecture

The system consists of two main containers:
1. **Caddy container**: Serves web traffic on ports 80/443 with socket activation
2. **Authelia container**: Provides authentication services with SSO and MFA support

## CLI Tool

This project includes a TypeScript CLI tool called `blueprint` for scaffolding and managing deployments.

### Installation and Development

**Global Installation (Recommended)**:
```bash
# Install globally for system-wide access
npm run install-global

# Or use npm link for development
npm run link

# Uninstall
npm run uninstall-global
# or
npm run unlink
```

**Local Development**:
```bash
# Build the CLI tool
npm run build

# Run in development mode
npm run dev

# Watch for changes during development
npm run watch

# Test the CLI locally
node dist/index.js --help
```

**After global installation, use the CLI anywhere**:
```bash
blueprint --version  # Check installed version
blueprint --help
blueprint init --name my-app
```

### CLI Commands
```bash
# Initialize a new deployment
blueprint init --name my-app --directory ./deployments

# Manage services
blueprint services list
blueprint services start caddy
blueprint services start authelia-postgres  # Authelia's dedicated PostgreSQL
blueprint services start authelia
blueprint services logs authelia-postgres -f

# Manage authentication
blueprint auth add-user --username john --email john@example.com
blueprint auth list-users

# Manage secrets
blueprint secrets setup
blueprint secrets show

# Manage domains
blueprint domain add --domain app.example.com --target http://localhost:3000
blueprint domain list
```

## Common Commands

### Container Management
```bash
# Start networks first (they auto-start with containers, but can be started explicitly)
systemctl --user start core-network.service
systemctl --user start addon-network.service

# Start containers (as user, not root)
systemctl --user start caddy.container
systemctl --user start authelia-postgres.container  # Start database first
systemctl --user start authelia.container

# Check container status
systemctl --user status caddy.container
systemctl --user status authelia-postgres.container
systemctl --user status authelia.container

# View container logs
journalctl --user -u caddy.container -f
journalctl --user -u authelia-postgres.container -f
journalctl --user -u authelia.container -f

# Restart containers after config changes
systemctl --user restart caddy.container
systemctl --user restart authelia-postgres.container
systemctl --user restart authelia.container

# Enable containers to start on boot
systemctl --user enable caddy.container
systemctl --user enable authelia-postgres.container
systemctl --user enable authelia.container
```

### Configuration Updates
```bash
# After modifying Caddyfile
systemctl --user restart caddy.container

# After modifying Authelia config
systemctl --user restart authelia.container

# Reload systemd units after modifying .container files
systemctl --user daemon-reload
```

## Project Structure

- `containers/`: All container definitions and configurations
  - `*.container`: systemd container unit files
  - `*.volume`: Volume definitions for persistent data
  - `*.network`: Network definitions for service isolation
  - `Caddyfile`: Caddy web server configuration
  - `authelia-config/`: Authelia configuration files
- `user/`: User-level systemd configurations (socket units)
- `secrets/`: All secret files (600 permissions)
  - `*.secret`: Secret values referenced directly by Secret= directives

## Key Configuration Files

### Caddy Configuration
- **File**: `containers/Caddyfile`
- **Purpose**: Defines web server routes, HTTPS settings, and reverse proxy rules
- **Socket Activation**: Uses systemd socket at file descriptor 3
- **Note**: Socket units don't support `PartOf=` directive (see [systemd.socket documentation](https://www.freedesktop.org/software/systemd/man/latest/systemd.socket.html))

### Authelia Configuration  
- **File**: `containers/authelia-config/configuration.yml`
- **Default User**: admin / changeme (change immediately in production)
- **Users File**: `containers/authelia-config/users_database.yml`
- **Features**: TOTP 2FA, session management, rate limiting

## Development Workflow

1. Modify configuration files in `containers/`
2. Test changes locally using systemctl commands
3. Use `systemctl --user daemon-reload` if modifying .container files
4. Restart affected containers
5. Check logs with journalctl for any issues

## Secrets Management

The CLI uses **file-based secrets** for better security:

- Each secret is stored in a separate `.secret` file in the `secrets/` directory
- Secret files have `600` permissions (owner read/write only)
- systemd container units use `Secret=` directives to mount secrets as environment variables
- Secret files are automatically excluded from git via `.gitignore`

### Secret File Structure
```
secrets/
├── authelia_jwt_secret.secret
├── authelia_session_secret.secret
├── authelia_storage_encryption_key.secret
├── authelia_postgres_password.secret
├── authelia_postgres_db.secret
├── authelia_postgres_user.secret
├── smtp_host.secret
├── smtp_port.secret
├── smtp_username.secret
├── smtp_password.secret
└── smtp_sender.secret
```

## Version Management

The CLI uses semantic versioning (semver) to track changes with conventional commits:

- **Patch releases** (1.1.X): Bug fixes, minor improvements
- **Minor releases** (1.X.0): New features, backwards-compatible changes  
- **Major releases** (X.0.0): Breaking changes (not used yet)

**Current version**: Check with `blueprint --version`

### Conventional Commits

Each version bump is accompanied by a conventional commit following the format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types used:**
- `feat:` New features (minor version bump)
- `fix:` Bug fixes (patch version bump)
- `docs:` Documentation changes (patch version bump)
- `refactor:` Code refactoring (patch version bump)

**Examples:**
```bash
feat: add domain-aware email configuration

fix: resolve SMTP connection timeout issues

docs: update installation instructions for global CLI
```

### Version History with Commits

- `v1.2.8`: Remove password confirmation from admin user creation
  - `fix: remove password confirmation prompt from init command`
- `v1.2.7`: Add password reset command and update SMTP username default
  - `feat: add reset-password command with strong password validation`
  - `feat: update default SMTP username to no-reply@mg.{domain}`
- `v1.2.5`: Fix password confirmation validation logic
  - `fix: fix password matching validation by checking after all prompts complete`
- `v1.2.4`: Add password confirmation validation
  - `fix: add validation to password confirmation prompt to ensure passwords match`
- `v1.2.3`: Fix missing password confirmation prompt
  - `fix: restore password confirmation prompt that was accidentally removed`
- `v1.2.2`: Improve password confirmation UX with retry loop
  - `feat: add password confirmation retry loop when passwords don't match`
- `v1.2.1`: Improve secrets implementation with file mounting and password confirmation
  - `feat: mount secrets as files instead of env vars, add password confirmation`
- `v1.2.0`: Create initial admin user during initialization with strong password requirements
  - `feat: add admin user creation with strong password validation during init`
- `v1.1.5`: From email address now uses Mailgun subdomain format (no-reply@mg.{domain})
  - `fix: update from email format to use Mailgun subdomain convention`
- `v1.1.4`: Pre-populate SMTP host with Mailgun EU as default
  - `fix: pre-populate SMTP host with Mailgun EU as default value`
- `v1.1.3`: Removed core services selection (Caddy + Authelia always included)
  - `refactor: remove core services selection (Caddy + Authelia always included)`
- `v1.1.2`: Admin email now uses project domain automatically
  - `feat: implement blueprint CLI with SMTP integration and domain-aware configuration`
- `v1.1.1`: Updated default SMTP provider to Mailgun EU
- `v1.1.0`: SMTP integration, file-based secrets, removed standalone services
- `v1.0.0`: Initial release with basic Caddy + Authelia setup

### Git Workflow

```bash
# After making changes and updating version in package.json
git add .
git commit -m "feat: add new deployment feature"
git tag -a v1.2.0 -m "v1.2.0: Feature description"
```

## Important Notes

- This uses systemd containers (Podman), NOT Docker or Docker Compose
- All container commands should be run as user (--user flag), not root
- Authelia automatically gets a dedicated PostgreSQL database (`authelia-postgres.container`)
- HTTPS is always enabled with automatic certificates via Caddy
- SMTP configuration is collected during `blueprint init` and used for all email notifications
- File-based secrets provide better security than environment files
- Install the CLI globally with `npm run install-global` to use `blueprint` commands anywhere
- The `deploy.sh` script is currently empty and needs implementation
- Socket activation is used for Caddy for efficient resource usage
- Version bumping follows semver: patch for fixes, minor for features, no majors yet
- don't forget to commit, build, and version bump every time