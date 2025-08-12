export const autheliaConfigTemplate = (config: any) => ({
  server: {
    address: 'tcp://0.0.0.0:9091/'
  },
  log: {
    level: 'info',
    format: 'text'
  },
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
    expiration: '1h',
    inactivity: '5m',
    cookies: [
      {
        domain: config.domain,
        authelia_url: `https://auth.${config.domain}`,
        default_redirection_url: `https://${config.domain}`
      }
    ]
  },
  regulation: {
    max_retries: 3,
    find_time: '120s',
    ban_time: '300s'
  },
  storage: {
    postgres: {
      address: 'tcp://authelia-postgres:5432'
    }
  },
  notifier: {
    disable_startup_check: false,
    smtp: {
      tls: {
        skip_verify: false,
        minimum_version: 'TLS1.2'
      }
    }
  }
});

export const autheliaUsersDatabaseTemplate = (adminPassword: string, config: any) => ({
  users: {
    [config.adminUsername || 'admin']: {
      displayname: config.adminDisplayName || 'Administrator',
      password: adminPassword,
      email: config.email,
      groups: ['admins', 'users']
    }
  }
});