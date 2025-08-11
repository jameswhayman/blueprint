export const autheliaPostgresContainerUnit = (secretsDir: string) => `[Unit]
Description=PostgreSQL Database for Authelia
After=network-online.target
Wants=network-online.target
DefaultDependencies=no

[Container]
ContainerName=authelia-postgres
Image=docker.io/library/postgres:15-alpine
Volume=authelia-postgres-data:/var/lib/postgresql/data
Network=podman
Environment=POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256
Environment=POSTGRES_DB_FILE=/run/secrets/POSTGRES_DB
Environment=POSTGRES_USER_FILE=/run/secrets/POSTGRES_USER
Environment=POSTGRES_PASSWORD_FILE=/run/secrets/POSTGRES_PASSWORD
Secret=POSTGRES_DB,target=POSTGRES_DB
Secret=POSTGRES_USER,target=POSTGRES_USER
Secret=STORAGE_PASSWORD,target=POSTGRES_PASSWORD

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