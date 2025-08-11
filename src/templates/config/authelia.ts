export const autheliaConfigTemplate = (config: any) => ({
  server: {
    host: '0.0.0.0',
    port: 9091
  },
  log: {
    level: 'info',
    format: 'text'
  },
  jwt_secret_file: '/run/secrets/AUTHELIA_JWT_SECRET',
  default_redirection_url: `https://${config.domain}`,
  totp: {
    issuer: config.name
  },
  authentication_backend: {
    file: {
      path: '/config/users_database.yml',
      password: {
        algorithm: 'argon2id',
        iterations: 1,
        salt_length: 16,
        parallelism: 8,
        memory: 64
      }
    }
  },
  access_control: {
    default_policy: 'deny',
    rules: [
      {
        domain: config.domain,
        policy: 'one_factor'
      },
      {
        domain: `*.${config.domain}`,
        policy: 'one_factor'
      }
    ]
  },
  session: {
    name: 'authelia_session',
    secret_file: '/run/secrets/AUTHELIA_SESSION_SECRET',
    expiration: '1h',
    inactivity: '5m',
    domain: config.domain
  },
  regulation: {
    max_retries: 3,
    find_time: '120s',
    ban_time: '300s'
  },
  storage: {
    encryption_key_file: '/run/secrets/AUTHELIA_STORAGE_ENCRYPTION_KEY',
    postgres: {
      host: 'authelia-postgres',
      port: 5432,
      database_file: '/run/secrets/AUTHELIA_POSTGRES_DB',
      username_file: '/run/secrets/AUTHELIA_POSTGRES_USER',
      password_file: '/run/secrets/AUTHELIA_POSTGRES_PASSWORD',
      sslmode: 'disable'
    }
  },
  notifier: {
    disable_startup_check: false,
    smtp: {
      host_file: '/run/secrets/SMTP_HOST',
      port_file: '/run/secrets/SMTP_PORT',
      username_file: '/run/secrets/SMTP_USERNAME',
      password_file: '/run/secrets/SMTP_PASSWORD',
      sender_file: '/run/secrets/SMTP_SENDER',
      tls: {
        skip_verify: false,
        minimum_version: 'TLS1.2'
      }
    }
  }
});

export const autheliaUsersDatabaseTemplate = (adminPassword: string, config: any) => ({
  users: {
    admin: {
      displayname: config.adminDisplayName || 'Administrator',
      password: adminPassword,
      email: config.email,
      groups: ['admins', 'users']
    }
  }
});