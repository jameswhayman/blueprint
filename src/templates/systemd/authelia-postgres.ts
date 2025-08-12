export const autheliaPostgresContainerUnit = (secretsDir: string) => `[Unit]
Description=PostgreSQL Database for Authelia
After=network-online.target core.network
Wants=network-online.target
Requires=core.network

[Container]
ContainerName=authelia-postgres
Image=docker.io/library/postgres:15-alpine
Volume=authelia-postgres-data:/var/lib/postgresql/data
Network=core
Environment=POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256
Secret=POSTGRES_DB,type=env,target=POSTGRES_DB
Secret=POSTGRES_USER,type=env,target=POSTGRES_USER
Secret=STORAGE_PASSWORD,type=env,target=POSTGRES_PASSWORD

[Service]
Restart=always
RestartSec=5s
TimeoutStartSec=60s

[Install]
WantedBy=default.target
`;

export const autheliaPostgresDataVolume = `[Volume]
VolumeSize=2G
`;