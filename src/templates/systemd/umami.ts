export const umamiContainerUnit = () => `[Unit]
Description=Umami Analytics
After=network-online.target umami-postgres.container
Requires=umami-postgres.container

[Container]
ContainerName=umami
Image=ghcr.io/umami-software/umami:postgresql-latest
Network=umami
HealthCmd=curl -f http://localhost:3000/api/heartbeat || exit 1
HealthInterval=5s
HealthTimeout=5s
HealthRetries=5

# Database connection string constructed from secrets
Secret=UMAMI_APP_SECRET,type=env,target=APP_SECRET
Secret=UMAMI_DATABASE_URL,type=env,target=DATABASE_URL
Environment=DATABASE_TYPE=postgresql

[Service]
Restart=always
RestartSec=5s
TimeoutStartSec=900

[Install]
WantedBy=default.target
`;

export const umamiDataVolume = `[Volume]
VolumeSize=1G
`;