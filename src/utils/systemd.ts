import fs from 'fs/promises';
import path from 'path';

export async function generateSystemdUnits(deployDir: string, service: string, config: any) {
  const containersDir = path.join(deployDir, 'containers');
  const userDir = path.join(deployDir, 'user');

  switch (service) {
    case 'caddy':
      await generateCaddySystemdUnits(containersDir, userDir, config);
      break;
    case 'authelia':
      await generateAutheliaSystemdUnits(containersDir, config);
      break;
    case 'authelia-postgres':
      await generateAutheliaPostgresSystemdUnits(containersDir, config);
      break;
  }
}

async function generateCaddySystemdUnits(containersDir: string, userDir: string, config: any) {
  const containerUnit = `[Unit]
Description=Caddy Web Server
Wants=caddy.socket
After=network-online.target caddy.socket
Requires=caddy.socket

[Container]
ContainerName=caddy
Image=docker.io/library/caddy:2-alpine
Volume=caddy-data.volume:/data
Volume=caddy-config.volume:/config
Volume=${containersDir}/Caddyfile:/etc/caddy/Caddyfile:ro,z
Network=container.network
PublishPort=80:80
PublishPort=443:443
Exec=/usr/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile

[Service]
Restart=always
RestartSec=5s
TimeoutStartSec=900

[Install]
WantedBy=default.target
`;

  const socketUnit = `[Unit]
Description=Caddy Web Server Socket
PartOf=caddy.container

[Socket]
ListenStream=80
ListenStream=443
SocketUser=1000
SocketGroup=1000

[Install]
WantedBy=sockets.target
`;

  const dataVolume = `[Volume]
VolumeSize=1G
`;

  const configVolume = `[Volume]
VolumeSize=100M
`;

  await fs.writeFile(path.join(containersDir, 'caddy.container'), containerUnit);
  await fs.writeFile(path.join(userDir, 'caddy.socket'), socketUnit);
  await fs.writeFile(path.join(containersDir, 'caddy-data.volume'), dataVolume);
  await fs.writeFile(path.join(containersDir, 'caddy-config.volume'), configVolume);
}

async function generateAutheliaSystemdUnits(containersDir: string, config: any) {
  const secretsDir = path.dirname(containersDir) + '/secrets';
  const containerUnit = `[Unit]
Description=Authelia Authentication Server
After=network-online.target authelia-postgres.container
Wants=network-online.target
Requires=authelia-postgres.container

[Container]
ContainerName=authelia
Image=docker.io/authelia/authelia:4
Volume=${containersDir}/authelia-config:/config:ro,z
Volume=authelia-data.volume:/data
Network=container.network
PublishPort=9091:9091
Secret=${secretsDir}/authelia_jwt_secret.secret,target=AUTHELIA_JWT_SECRET
Secret=${secretsDir}/authelia_session_secret.secret,target=AUTHELIA_SESSION_SECRET
Secret=${secretsDir}/authelia_storage_encryption_key.secret,target=AUTHELIA_STORAGE_ENCRYPTION_KEY
Secret=${secretsDir}/authelia_postgres_password.secret,target=AUTHELIA_POSTGRES_PASSWORD
Secret=${secretsDir}/authelia_postgres_db.secret,target=AUTHELIA_POSTGRES_DB
Secret=${secretsDir}/authelia_postgres_user.secret,target=AUTHELIA_POSTGRES_USER
Secret=${secretsDir}/smtp_host.secret,target=SMTP_HOST
Secret=${secretsDir}/smtp_port.secret,target=SMTP_PORT
Secret=${secretsDir}/smtp_username.secret,target=SMTP_USERNAME
Secret=${secretsDir}/smtp_password.secret,target=SMTP_PASSWORD
Secret=${secretsDir}/smtp_sender.secret,target=SMTP_SENDER

[Service]
Restart=always
RestartSec=5s
TimeoutStartSec=60s

[Install]
WantedBy=default.target
`;

  const dataVolume = `[Volume]
VolumeSize=500M
`;

  await fs.writeFile(path.join(containersDir, 'authelia.container'), containerUnit);
  await fs.writeFile(path.join(containersDir, 'authelia-data.volume'), dataVolume);

  // No need for separate secret unit files - Secret= directive references files directly
}

async function generateAutheliaPostgresSystemdUnits(containersDir: string, config: any) {
  const secretsDir = path.dirname(containersDir) + '/secrets';
  const containerUnit = `[Unit]
Description=PostgreSQL Database for Authelia
After=network-online.target
Wants=network-online.target

[Container]
ContainerName=authelia-postgres
Image=docker.io/library/postgres:15-alpine
Volume=authelia-postgres-data.volume:/var/lib/postgresql/data
Network=container.network
Environment=POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256
Environment=POSTGRES_DB_FILE=/run/secrets/POSTGRES_DB
Environment=POSTGRES_USER_FILE=/run/secrets/POSTGRES_USER
Environment=POSTGRES_PASSWORD_FILE=/run/secrets/POSTGRES_PASSWORD
Secret=${secretsDir}/authelia_postgres_db.secret,target=POSTGRES_DB
Secret=${secretsDir}/authelia_postgres_user.secret,target=POSTGRES_USER
Secret=${secretsDir}/authelia_postgres_password.secret,target=POSTGRES_PASSWORD

[Service]
Restart=always
RestartSec=5s
TimeoutStartSec=60s

[Install]
WantedBy=default.target
`;

  const dataVolume = `[Volume]
VolumeSize=2G
`;

  await fs.writeFile(path.join(containersDir, 'authelia-postgres.container'), containerUnit);
  await fs.writeFile(path.join(containersDir, 'authelia-postgres-data.volume'), dataVolume);
}

