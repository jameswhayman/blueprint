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
Secret=authelia_jwt_secret,type=env,target=AUTHELIA_JWT_SECRET
Secret=authelia_session_secret,type=env,target=AUTHELIA_SESSION_SECRET
Secret=authelia_storage_encryption_key,type=env,target=AUTHELIA_STORAGE_ENCRYPTION_KEY
Secret=authelia_postgres_password,type=env,target=AUTHELIA_POSTGRES_PASSWORD
Secret=authelia_postgres_db,type=env,target=AUTHELIA_POSTGRES_DB
Secret=authelia_postgres_user,type=env,target=AUTHELIA_POSTGRES_USER
Secret=smtp_host,type=env,target=SMTP_HOST
Secret=smtp_port,type=env,target=SMTP_PORT
Secret=smtp_username,type=env,target=SMTP_USERNAME
Secret=smtp_password,type=env,target=SMTP_PASSWORD
Secret=smtp_sender,type=env,target=SMTP_SENDER

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

  // Generate secret units
  const secrets = [
    'authelia_jwt_secret',
    'authelia_session_secret', 
    'authelia_storage_encryption_key',
    'authelia_postgres_password',
    'authelia_postgres_db',
    'authelia_postgres_user',
    'smtp_host',
    'smtp_port',
    'smtp_username',
    'smtp_password',
    'smtp_sender'
  ];

  for (const secretName of secrets) {
    const secretUnit = `[Secret]
Path=${secretsDir}/${secretName}.secret
`;
    await fs.writeFile(path.join(containersDir, `${secretName}.secret`), secretUnit);
  }
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
Secret=authelia_postgres_db,type=env,target=POSTGRES_DB
Secret=authelia_postgres_user,type=env,target=POSTGRES_USER
Secret=authelia_postgres_password,type=env,target=POSTGRES_PASSWORD

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

