export const autheliaPostgresContainerUnit = (secretsDir: string) => `[Unit]
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

export const autheliaPostgresDataVolume = `[Volume]
VolumeSize=2G
`;