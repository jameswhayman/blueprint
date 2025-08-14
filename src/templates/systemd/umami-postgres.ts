export const umamiPostgresContainerUnit = () => `[Unit]
Description=PostgreSQL Database for Umami Analytics
After=network-online.target
Before=umami.container

[Container]
ContainerName=umami-postgres
Image=docker.io/library/postgres:15-alpine
Volume=umami-postgres-data:/var/lib/postgresql/data
Network=umami
HealthCmd=pg_isready -U umami -d umami
HealthInterval=5s
HealthTimeout=5s
HealthRetries=5

# Database credentials from Podman secrets (prefixed with UMAMI_)
Secret=UMAMI_POSTGRES_DB,type=env,target=POSTGRES_DB
Secret=UMAMI_POSTGRES_USER,type=env,target=POSTGRES_USER
Secret=UMAMI_POSTGRES_PASSWORD,type=env,target=POSTGRES_PASSWORD

[Service]
Restart=always
RestartSec=5s
TimeoutStartSec=900

[Install]
WantedBy=default.target
`;

export const umamiPostgresDataVolume = `[Volume]
VolumeSize=5G
`;