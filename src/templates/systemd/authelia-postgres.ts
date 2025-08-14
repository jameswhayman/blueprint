export const autheliaPostgresContainerUnit = () => `[Unit]
Description=PostgreSQL Database for Authelia
After=network-online.target
Wants=network-online.target

[Container]
ContainerName=authelia-postgres
Image=docker.io/library/postgres:15-alpine
Volume=authelia-postgres-data:/var/lib/postgresql/data
Network=core
Environment=POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256
Secret=AUTHELIA_POSTGRES_DB,type=env,target=POSTGRES_DB
Secret=AUTHELIA_POSTGRES_USER,type=env,target=POSTGRES_USER
Secret=AUTHELIA_POSTGRES_PASSWORD,type=env,target=POSTGRES_PASSWORD

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